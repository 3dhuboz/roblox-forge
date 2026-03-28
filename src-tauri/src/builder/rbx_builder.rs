use anyhow::{anyhow, Context, Result};
use rbx_dom_weak::types::{
    Attributes, CFrame, Color3, Color3uint8, Matrix3, Tags, Variant, Vector3,
};
use rbx_dom_weak::{InstanceBuilder, WeakDom};
use std::fs;
use std::path::Path;

/// Build a .rbxl file natively from a Rojo project structure.
/// No external Rojo binary needed — uses rbx-dom directly.
pub fn build_rbxl(project_path: &str) -> Result<Vec<u8>> {
    let base = Path::new(project_path);
    let project_file = base.join("default.project.json");
    let project_json: serde_json::Value = serde_json::from_str(
        &fs::read_to_string(&project_file)
            .with_context(|| format!("Cannot read {}", project_file.display()))?,
    )?;

    let tree = project_json
        .get("tree")
        .ok_or_else(|| anyhow!("default.project.json missing 'tree' field"))?;

    // Build the DOM starting from DataModel
    let data_model = InstanceBuilder::new("DataModel");
    let mut dom = WeakDom::new(data_model);
    let root_ref = dom.root_ref();

    // Process each child of the tree (services like Workspace, SSS, etc.)
    if let Some(obj) = tree.as_object() {
        for (key, value) in obj {
            if key.starts_with('$') {
                continue; // Skip $className, $properties, etc. at root level
            }
            process_tree_node(&mut dom, root_ref, key, value, base)?;
        }
    }

    // Serialize to binary .rbxl
    let root_ref = dom.root_ref();
    let root_children: Vec<_> = dom.get_by_ref(root_ref).unwrap().children().to_vec();
    let mut output = Vec::new();
    rbx_binary::to_writer(&mut output, &dom, &root_children)
        .context("Failed to serialize DOM to .rbxl")?;

    Ok(output)
}

fn process_tree_node(
    dom: &mut WeakDom,
    parent_ref: rbx_dom_weak::types::Ref,
    name: &str,
    node: &serde_json::Value,
    base_path: &Path,
) -> Result<()> {
    let class_name = node
        .get("$className")
        .and_then(|v| v.as_str())
        .unwrap_or("Folder");

    let mut builder = InstanceBuilder::new(class_name).with_name(name);

    // Apply $properties
    if let Some(props) = node.get("$properties").and_then(|v| v.as_object()) {
        for (prop_name, prop_value) in props {
            if let Some(variant) = json_to_variant(prop_name, prop_value) {
                builder = builder.with_property(prop_name, variant);
            }
        }
    }

    let instance_ref = dom.insert(parent_ref, builder);

    // Process $path — load file/directory content
    if let Some(path_str) = node.get("$path").and_then(|v| v.as_str()) {
        let full_path = base_path.join(path_str);
        if full_path.is_file() {
            load_file_into_instance(dom, instance_ref, &full_path, name)?;
        } else if full_path.is_dir() {
            load_directory_children(dom, instance_ref, &full_path, base_path)?;
        }
    }

    // Process child nodes (non-$ keys)
    if let Some(obj) = node.as_object() {
        for (key, value) in obj {
            if key.starts_with('$') {
                continue;
            }
            if value.is_object() {
                process_tree_node(dom, instance_ref, key, value, base_path)?;
            }
        }
    }

    Ok(())
}

/// Load a file's content into an instance based on its extension.
fn load_file_into_instance(
    dom: &mut WeakDom,
    instance_ref: rbx_dom_weak::types::Ref,
    file_path: &Path,
    _name: &str,
) -> Result<()> {
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let file_name = file_path
        .file_name()
        .and_then(|f| f.to_str())
        .unwrap_or("");

    match ext {
        "luau" | "lua" => {
            let content = fs::read_to_string(file_path)?;
            let instance = dom.get_by_ref_mut(instance_ref).unwrap();

            // Determine script type from filename convention
            let class_name = if file_name.contains(".server.") {
                "Script"
            } else if file_name.contains(".client.") {
                "LocalScript"
            } else {
                "ModuleScript"
            };

            // Update the instance class and set source
            instance.class = class_name.into();
            instance
                .properties
                .insert("Source".into(), Variant::String(content));
        }
        "json" if file_name.ends_with(".model.json") => {
            let content = fs::read_to_string(file_path)?;
            let model: serde_json::Value = serde_json::from_str(&content)
                .with_context(|| format!("Invalid JSON in {}", file_path.display()))?;
            apply_model_json(dom, instance_ref, &model)?;
        }
        _ => {}
    }

    Ok(())
}

/// Load all files in a directory as child instances.
fn load_directory_children(
    dom: &mut WeakDom,
    parent_ref: rbx_dom_weak::types::Ref,
    dir_path: &Path,
    _base_path: &Path,
) -> Result<()> {
    let entries = fs::read_dir(dir_path)?;
    let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            // Subdirectory becomes a Folder
            let folder = InstanceBuilder::new("Folder").with_name(&fname);
            let folder_ref = dom.insert(parent_ref, folder);
            load_directory_children(dom, folder_ref, &path, _base_path)?;
        } else if fname.ends_with(".model.json") {
            // Model file — the instance name is the filename without .model.json
            let inst_name = fname
                .strip_suffix(".model.json")
                .unwrap_or(&fname)
                .to_string();
            let content = fs::read_to_string(&path)?;
            let model: serde_json::Value = serde_json::from_str(&content)
                .with_context(|| format!("Invalid JSON in {}", path.display()))?;

            let class_name = model
                .get("className")
                .and_then(|v| v.as_str())
                .unwrap_or("Folder");

            let builder = InstanceBuilder::new(class_name).with_name(&inst_name);
            let inst_ref = dom.insert(parent_ref, builder);
            apply_model_json(dom, inst_ref, &model)?;
        } else if fname.ends_with(".luau") || fname.ends_with(".lua") {
            // Script file
            let script_name = fname
                .strip_suffix(".server.luau")
                .or_else(|| fname.strip_suffix(".client.luau"))
                .or_else(|| fname.strip_suffix(".luau"))
                .or_else(|| fname.strip_suffix(".lua"))
                .unwrap_or(&fname);

            let class_name = if fname.contains(".server.") {
                "Script"
            } else if fname.contains(".client.") {
                "LocalScript"
            } else {
                "ModuleScript"
            };

            let content = fs::read_to_string(&path)?;
            let builder = InstanceBuilder::new(class_name)
                .with_name(script_name)
                .with_property("Source", Variant::String(content));
            dom.insert(parent_ref, builder);
        }
    }

    Ok(())
}

/// Apply a model.json structure to an existing instance.
fn apply_model_json(
    dom: &mut WeakDom,
    instance_ref: rbx_dom_weak::types::Ref,
    model: &serde_json::Value,
) -> Result<()> {
    // Apply properties to this instance (skip Name — handled by InstanceBuilder)
    if let Some(props) = model.get("properties").and_then(|v| v.as_object()) {
        let instance = dom.get_by_ref_mut(instance_ref).unwrap();
        for (key, value) in props {
            if key == "Name" {
                continue; // Name is set via InstanceBuilder, not as a property
            }
            if let Some(variant) = parse_model_property(key, value) {
                instance.properties.insert(key.as_str().into(), variant);
            }
        }
    }

    // Process children
    if let Some(children) = model.get("children").and_then(|v| v.as_array()) {
        for child in children {
            let class_name = child
                .get("className")
                .and_then(|v| v.as_str())
                .unwrap_or("Part");

            let name = child
                .get("properties")
                .and_then(|p| p.get("Name"))
                .and_then(|n| n.get("String"))
                .and_then(|s| s.as_str())
                .unwrap_or(class_name);

            let builder = InstanceBuilder::new(class_name).with_name(name);
            let child_ref = dom.insert(instance_ref, builder);
            apply_model_json(dom, child_ref, child)?;
        }
    }

    Ok(())
}

/// Parse a property value from the model.json format into an rbx-dom Variant.
fn parse_model_property(key: &str, value: &serde_json::Value) -> Option<Variant> {
    if let Some(obj) = value.as_object() {
        // Typed property format: { "TypeName": value }
        if let Some(v) = obj.get("String").and_then(|v| v.as_str()) {
            return Some(Variant::String(v.to_string()));
        }
        if let Some(v) = obj.get("Bool") {
            return v.as_bool().map(Variant::Bool);
        }
        if let Some(v) = obj.get("Float32") {
            return v.as_f64().map(|f| Variant::Float32(f as f32));
        }
        if let Some(v) = obj.get("Float64") {
            return v.as_f64().map(Variant::Float64);
        }
        if let Some(v) = obj.get("Int32") {
            return v.as_i64().map(|i| Variant::Int32(i as i32));
        }
        if let Some(v) = obj.get("Int64") {
            return v.as_i64().map(Variant::Int64);
        }
        if let Some(arr) = obj.get("Vector3").and_then(|v| v.as_array()) {
            if arr.len() == 3 {
                return Some(Variant::Vector3(Vector3::new(
                    arr[0].as_f64().unwrap_or(0.0) as f32,
                    arr[1].as_f64().unwrap_or(0.0) as f32,
                    arr[2].as_f64().unwrap_or(0.0) as f32,
                )));
            }
        }
        if let Some(cframe_obj) = obj.get("CFrame") {
            return parse_cframe(cframe_obj);
        }
        if let Some(arr) = obj.get("Color3uint8").and_then(|v| v.as_array()) {
            if arr.len() == 3 {
                return Some(Variant::Color3uint8(Color3uint8::new(
                    arr[0].as_u64().unwrap_or(0) as u8,
                    arr[1].as_u64().unwrap_or(0) as u8,
                    arr[2].as_u64().unwrap_or(0) as u8,
                )));
            }
        }
        if let Some(arr) = obj.get("Color3").and_then(|v| v.as_array()) {
            if arr.len() == 3 {
                return Some(Variant::Color3(Color3::new(
                    arr[0].as_f64().unwrap_or(0.0) as f32,
                    arr[1].as_f64().unwrap_or(0.0) as f32,
                    arr[2].as_f64().unwrap_or(0.0) as f32,
                )));
            }
        }
        if let Some(v) = obj.get("Enum") {
            return v.as_u64().map(|e| Variant::Enum(rbx_dom_weak::types::Enum::from_u32(e as u32)));
        }
        if let Some(arr) = obj.get("Tags").and_then(|v| v.as_array()) {
            let tags: Vec<String> = arr
                .iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect();
            let mut t = Tags::new();
            for tag in &tags {
                t.push(tag);
            }
            return Some(Variant::Tags(t));
        }
        if let Some(attrs_obj) = obj.get("Attributes").and_then(|v| v.as_object()) {
            let mut attrs = Attributes::new();
            for (attr_key, attr_val) in attrs_obj {
                if let Some(variant) = parse_attribute_value(attr_val) {
                    attrs.insert(attr_key.clone(), variant);
                }
            }
            return Some(Variant::Attributes(attrs));
        }
        // UDim2 format: [[scaleX, offsetX], [scaleY, offsetY]]
        if let Some(arr) = obj.get("UDim2").and_then(|v| v.as_array()) {
            if arr.len() == 2 {
                if let (Some(x), Some(y)) = (arr[0].as_array(), arr[1].as_array()) {
                    if x.len() == 2 && y.len() == 2 {
                        return Some(Variant::UDim2(rbx_dom_weak::types::UDim2::new(
                            rbx_dom_weak::types::UDim::new(
                                x[0].as_f64().unwrap_or(0.0) as f32,
                                x[1].as_i64().unwrap_or(0) as i32,
                            ),
                            rbx_dom_weak::types::UDim::new(
                                y[0].as_f64().unwrap_or(0.0) as f32,
                                y[1].as_i64().unwrap_or(0) as i32,
                            ),
                        )));
                    }
                }
            }
        }
    }

    // Direct value (bare number — could be Float32, Int32, or Enum)
    // Use key name heuristics to decide
    if let Some(n) = value.as_f64() {
        let enum_keys = [
            "Material", "Font", "Face", "Shape", "SurfaceType",
            "TopSurface", "BottomSurface", "LeftSurface", "RightSurface",
            "FrontSurface", "BackSurface", "CameraMode", "CameraType",
            "EasingStyle", "EasingDirection", "HorizontalAlignment",
            "VerticalAlignment", "SortOrder", "BorderMode", "SizeConstraint",
            "TextXAlignment", "TextYAlignment", "ScaleType",
        ];
        if enum_keys.iter().any(|k| key.contains(k)) {
            return Some(Variant::Enum(rbx_dom_weak::types::Enum::from_u32(n as u32)));
        }
        // Integer-looking values for IntValue-like properties
        if n.fract() == 0.0 && key.contains("Value") {
            return Some(Variant::Int32(n as i32));
        }
        return Some(Variant::Float32(n as f32));
    }
    if let Some(s) = value.as_str() {
        return Some(Variant::String(s.to_string()));
    }
    if let Some(b) = value.as_bool() {
        return Some(Variant::Bool(b));
    }

    // For arrays at top level (e.g., Lighting Color3 as [0.5, 0.5, 0.5])
    if let Some(arr) = value.as_array() {
        if arr.len() == 3 && arr[0].is_f64() {
            // Could be Color3 or Vector3 — use key name to decide
            let v0 = arr[0].as_f64().unwrap_or(0.0) as f32;
            let v1 = arr[1].as_f64().unwrap_or(0.0) as f32;
            let v2 = arr[2].as_f64().unwrap_or(0.0) as f32;

            let color_keys = [
                "Ambient",
                "OutdoorAmbient",
                "FogColor",
                "ColorShift_Top",
                "ColorShift_Bottom",
                "TextColor3",
                "BackgroundColor3",
            ];
            if color_keys.iter().any(|k| key.contains(k)) {
                return Some(Variant::Color3(Color3::new(v0, v1, v2)));
            }
            return Some(Variant::Vector3(Vector3::new(v0, v1, v2)));
        }
    }

    None
}

fn parse_cframe(value: &serde_json::Value) -> Option<Variant> {
    if let Some(obj) = value.as_object() {
        let pos = obj.get("position")?.as_array()?;
        let orient = obj.get("orientation")?.as_array()?;
        if pos.len() == 3 && orient.len() == 9 {
            let px = pos[0].as_f64().unwrap_or(0.0) as f32;
            let py = pos[1].as_f64().unwrap_or(0.0) as f32;
            let pz = pos[2].as_f64().unwrap_or(0.0) as f32;

            let o: Vec<f32> = orient
                .iter()
                .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                .collect();

            return Some(Variant::CFrame(CFrame::new(
                Vector3::new(px, py, pz),
                Matrix3::new(
                    Vector3::new(o[0], o[1], o[2]),
                    Vector3::new(o[3], o[4], o[5]),
                    Vector3::new(o[6], o[7], o[8]),
                ),
            )));
        }
    }
    // Flat array format [px, py, pz, r00, r01, r02, r10, r11, r12]
    if let Some(arr) = value.as_array() {
        if arr.len() == 12 {
            let f: Vec<f32> = arr
                .iter()
                .map(|v| v.as_f64().unwrap_or(0.0) as f32)
                .collect();
            return Some(Variant::CFrame(CFrame::new(
                Vector3::new(f[0], f[1], f[2]),
                Matrix3::new(
                    Vector3::new(f[3], f[4], f[5]),
                    Vector3::new(f[6], f[7], f[8]),
                    Vector3::new(f[9], f[10], f[11]),
                ),
            )));
        }
    }
    None
}

fn parse_attribute_value(value: &serde_json::Value) -> Option<Variant> {
    if let Some(obj) = value.as_object() {
        if let Some(v) = obj.get("Float64") {
            return v.as_f64().map(Variant::Float64);
        }
        if let Some(v) = obj.get("String") {
            return v.as_str().map(|s| Variant::String(s.to_string()));
        }
        if let Some(v) = obj.get("Bool") {
            return v.as_bool().map(Variant::Bool);
        }
    }
    // Direct values
    if let Some(n) = value.as_f64() {
        return Some(Variant::Float64(n));
    }
    if let Some(s) = value.as_str() {
        return Some(Variant::String(s.to_string()));
    }
    if let Some(b) = value.as_bool() {
        return Some(Variant::Bool(b));
    }
    None
}

/// Convert a $properties value from project.json format into an rbx-dom Variant.
/// project.json uses simpler direct values (not typed wrappers).
fn json_to_variant(key: &str, value: &serde_json::Value) -> Option<Variant> {
    // project.json $properties use direct values, not typed wrappers
    // e.g., "Brightness": 2, "Ambient": [0.5, 0.5, 0.5]
    parse_model_property(key, value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_obby_template() {
        // Find the obby template relative to CARGO_MANIFEST_DIR
        let manifest_dir = env!("CARGO_MANIFEST_DIR");
        let template_path = Path::new(manifest_dir)
            .parent()
            .unwrap()
            .join("templates")
            .join("obby");

        if !template_path.exists() {
            eprintln!("Obby template not found at {:?}, skipping", template_path);
            return;
        }

        let result = build_rbxl(template_path.to_str().unwrap());
        match &result {
            Ok(data) => {
                assert!(data.len() > 100, "rbxl file too small: {} bytes", data.len());
                eprintln!("Built obby template: {} bytes", data.len());
            }
            Err(e) => {
                // Print full error chain
                eprintln!("Error: {}", e);
                let mut source = e.source();
                while let Some(cause) = source {
                    eprintln!("Caused by: {}", cause);
                    source = std::error::Error::source(cause);
                }
                panic!("Failed to build obby template: {:?}", e);
            }
        }
    }

    #[test]
    fn test_parse_model_property_types() {
        // String
        let v = parse_model_property("Name", &serde_json::json!({"String": "TestPart"}));
        assert!(matches!(v, Some(Variant::String(_))));

        // Bool
        let v = parse_model_property("Anchored", &serde_json::json!({"Bool": true}));
        assert!(matches!(v, Some(Variant::Bool(true))));

        // Vector3
        let v = parse_model_property("Size", &serde_json::json!({"Vector3": [10.0, 5.0, 20.0]}));
        assert!(matches!(v, Some(Variant::Vector3(_))));

        // Color3uint8
        let v = parse_model_property("Color3uint8", &serde_json::json!({"Color3uint8": [255, 0, 0]}));
        assert!(matches!(v, Some(Variant::Color3uint8(_))));

        // Enum
        let v = parse_model_property("Material", &serde_json::json!({"Enum": 256}));
        assert!(matches!(v, Some(Variant::Enum(_))));

        // Tags
        let v = parse_model_property("Tags", &serde_json::json!({"Tags": ["KillBrick", "Spinner"]}));
        assert!(matches!(v, Some(Variant::Tags(_))));
    }

    #[test]
    fn test_parse_cframe() {
        let cf = super::parse_cframe(&serde_json::json!({
            "position": [10.0, 5.0, 20.0],
            "orientation": [1, 0, 0, 0, 1, 0, 0, 0, 1]
        }));
        assert!(cf.is_some());
    }
}
