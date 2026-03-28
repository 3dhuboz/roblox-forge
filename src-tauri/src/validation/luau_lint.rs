use std::path::Path;

/// A Luau lint issue with location info.
pub struct LuauIssue {
    pub message: String,
    pub line: usize,
    pub severity: &'static str,
}

/// Validate a Luau script for common issues.
/// This is NOT a full parser — it catches the most common mistakes
/// that would cause runtime errors in Roblox.
pub fn lint_luau(content: &str, file_path: &Path) -> Vec<LuauIssue> {
    let mut issues = Vec::new();
    let lines: Vec<&str> = content.lines().collect();
    let is_server = file_path
        .to_string_lossy()
        .contains(".server.");
    let is_client = file_path
        .to_string_lossy()
        .contains(".client.");

    // Track block depth for balanced end/do/function
    let mut depth: i32 = 0;
    let mut in_multiline_string = false;
    let mut in_multiline_comment = false;

    for (line_num, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        let line_1based = line_num + 1;

        // Handle multiline comments
        if in_multiline_comment {
            if trimmed.contains("]]") {
                in_multiline_comment = false;
            }
            continue;
        }
        if trimmed.starts_with("--[[") {
            in_multiline_comment = true;
            if trimmed.contains("]]") {
                in_multiline_comment = false;
            }
            continue;
        }

        // Skip single-line comments
        if trimmed.starts_with("--") {
            continue;
        }

        // Handle multiline strings
        if in_multiline_string {
            if trimmed.contains("]]") {
                in_multiline_string = false;
            }
            continue;
        }
        if trimmed.contains("[[") && !trimmed.contains("]]") {
            in_multiline_string = true;
        }

        // Remove inline comments for analysis
        let code = if let Some(pos) = trimmed.find("--") {
            &trimmed[..pos]
        } else {
            trimmed
        };

        // ── Block depth tracking ──
        // Openers
        if code.contains("function ") || code.contains("function(") {
            depth += 1;
        } else if code == "do"
            || (code.starts_with("for ") && code.ends_with(" do"))
            || (code.starts_with("while ") && code.ends_with(" do"))
        {
            depth += 1;
        } else if code.starts_with("if ") && code.contains(" then") && !code.contains(" end") {
            depth += 1;
        } else if code == "repeat" || code.starts_with("repeat") {
            depth += 1;
        }

        // Closers
        if code == "end"
            || code.starts_with("end)")
            || code.starts_with("end,")
            || code.starts_with("end;")
        {
            depth -= 1;
        }
        if code == "until" || code.starts_with("until ") {
            depth -= 1;
        }

        // ── Common mistakes ──

        // Server script using client-only APIs
        if is_server {
            if code.contains("UserInputService") && !code.contains("GetService") {
                issues.push(LuauIssue {
                    message: "Server script using UserInputService (client-only)".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
            if code.contains(".OnClientEvent") {
                issues.push(LuauIssue {
                    message: "Server script using OnClientEvent (use OnServerEvent instead)".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
            if code.contains(":FireServer(") {
                issues.push(LuauIssue {
                    message: "Server script using FireServer (use FireClient instead)".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
            if code.contains("LocalPlayer") {
                issues.push(LuauIssue {
                    message: "Server script accessing LocalPlayer (client-only)".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
        }

        // Client script using server-only APIs
        if is_client {
            if code.contains(".OnServerEvent") {
                issues.push(LuauIssue {
                    message: "Client script using OnServerEvent (use OnClientEvent instead)".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
            if code.contains(":FireClient(") {
                issues.push(LuauIssue {
                    message: "Client script using FireClient (use FireServer instead)".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
            if code.contains("ServerScriptService") || code.contains("ServerStorage") {
                issues.push(LuauIssue {
                    message: "Client script accessing server-only service".into(),
                    line: line_1based,
                    severity: "error",
                });
            }
        }

        // DataStore without pcall
        if code.contains(":GetAsync(") || code.contains(":SetAsync(") || code.contains(":UpdateAsync(") {
            // Check if it's inside a pcall (look at surrounding lines)
            let context_start = if line_num >= 3 { line_num - 3 } else { 0 };
            let context = lines[context_start..=line_num].join(" ");
            if !context.contains("pcall") && !context.contains("withRetry") {
                issues.push(LuauIssue {
                    message: "DataStore operation without pcall — will crash on failure".into(),
                    line: line_1based,
                    severity: "warning",
                });
            }
        }

        // Infinite loop without yield
        if (code.starts_with("while true") || code == "while true do") && !code.contains("wait") {
            // Check next few lines for task.wait or wait()
            let next_lines: String = lines
                .iter()
                .skip(line_num + 1)
                .take(5)
                .cloned()
                .collect::<Vec<_>>()
                .join(" ");
            if !next_lines.contains("task.wait") && !next_lines.contains("wait(") {
                issues.push(LuauIssue {
                    message: "while true loop may lack yield (task.wait) — could freeze game".into(),
                    line: line_1based,
                    severity: "warning",
                });
            }
        }

        // Deprecated wait() usage
        if code.contains("wait(") && !code.contains("task.wait") && !code.contains("WaitForChild") {
            issues.push(LuauIssue {
                message: "Using deprecated wait() — use task.wait() instead".into(),
                line: line_1based,
                severity: "info",
            });
        }

        // game.Workspace instead of workspace
        if code.contains("game.Workspace") || code.contains("game:GetService(\"Workspace\")") {
            issues.push(LuauIssue {
                message: "Use 'workspace' global instead of game.Workspace".into(),
                line: line_1based,
                severity: "info",
            });
        }
    }

    // Final depth check
    if depth > 0 {
        issues.push(LuauIssue {
            message: format!("Missing 'end' keyword ({} unclosed blocks)", depth),
            line: lines.len(),
            severity: "error",
        });
    } else if depth < 0 {
        issues.push(LuauIssue {
            message: format!("Extra 'end' keyword ({} extra)", -depth),
            line: lines.len(),
            severity: "error",
        });
    }

    issues
}
