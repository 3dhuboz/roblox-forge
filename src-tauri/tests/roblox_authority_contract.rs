use roblox_forge_lib::roblox_authority::{
    analytics_status, normalize_poll_path, parse_publish_version_body, validate_api_key_secret,
    validate_credential_alias, validate_roblox_id, AnalyticsDataPoint, AnalyticsGranularity,
    AnalyticsMetric, AnalyticsPointQuality, AnalyticsResultStatus, CapabilityState,
    CredentialMetadata, CredentialPurpose, IntrospectionDocument, PublishHttpDisposition,
    RegistryDocument, RegistryStore, VerifiedRobloxTarget, MAX_PLACE_BYTES,
    MAX_PUBLISH_RESPONSE_BYTES,
};

#[test]
fn roblox_ids_are_strict_positive_decimal_strings() {
    assert_eq!(validate_roblox_id("123456").unwrap(), "123456");

    for invalid in ["", "0", " 12", "12 ", "+12", "-12", "1.2", "abc"] {
        assert!(validate_roblox_id(invalid).is_err(), "accepted {invalid:?}");
    }
}

#[test]
fn credential_aliases_cannot_escape_the_vault_namespace() {
    assert_eq!(
        validate_credential_alias("publish-default").unwrap(),
        "publish-default"
    );

    for invalid in ["", "../publish", "publish/key", "Publish Key", "x-api-key"] {
        assert!(
            validate_credential_alias(invalid).is_err(),
            "accepted {invalid:?}"
        );
    }
}

#[test]
fn api_keys_are_validated_without_returning_or_fingerprinting_them() {
    assert!(validate_api_key_secret("a234567890123456").is_ok());

    for invalid in [
        "short",
        " leading-secret",
        "trailing-secret ",
        "line\nbreak",
    ] {
        assert!(validate_api_key_secret(invalid).is_err());
    }
}

#[test]
fn ambiguous_publish_responses_are_never_safe_to_retry_automatically() {
    assert_eq!(
        PublishHttpDisposition::from_response(200, Some(42)),
        PublishHttpDisposition::Succeeded
    );
    assert_eq!(
        PublishHttpDisposition::from_response(200, None),
        PublishHttpDisposition::OutcomeUnknown
    );
    assert_eq!(
        PublishHttpDisposition::from_response(429, None),
        PublishHttpDisposition::OutcomeUnknown
    );
    assert_eq!(
        PublishHttpDisposition::from_response(503, None),
        PublishHttpDisposition::OutcomeUnknown
    );
    assert_eq!(
        PublishHttpDisposition::from_response(400, None),
        PublishHttpDisposition::Rejected
    );
}

#[test]
fn publish_version_body_must_be_small_well_formed_and_authoritative() {
    assert_eq!(
        parse_publish_version_body(br#"{"versionNumber":42}"#).unwrap(),
        42
    );
    assert!(parse_publish_version_body(br#"{}"#).is_err());
    assert!(parse_publish_version_body(br#"{"versionNumber":"not-a-number"}"#).is_err());
    assert!(parse_publish_version_body(&vec![b' '; MAX_PUBLISH_RESPONSE_BYTES + 1]).is_err());
}

#[test]
fn analytics_poll_paths_are_bound_to_the_verified_universe() {
    assert_eq!(
        normalize_poll_path(
            "123",
            "v1/universes/123/operations/metrics/operation_ABC-123"
        )
        .unwrap(),
        "v1/universes/123/operations/metrics/operation_ABC-123"
    );

    for invalid in [
        "https://attacker.example/steal",
        "v1/universes/456/operations/metrics/op",
        "../v1/universes/123/operations/metrics/op",
        "v1/universes/123/operations/metrics/op/extra",
    ] {
        assert!(normalize_poll_path("123", invalid).is_err());
    }
}

#[test]
fn analytics_zero_is_available_and_not_no_data() {
    let points = vec![AnalyticsDataPoint {
        time: "2026-07-01T00:00:00Z".to_owned(),
        value: Some(0.0),
        string_values: Vec::new(),
        quality: Some(AnalyticsPointQuality::Valid),
    }];

    assert_eq!(
        analytics_status(&points, false),
        AnalyticsResultStatus::Available
    );
    assert_eq!(analytics_status(&[], false), AnalyticsResultStatus::NoData);
}

#[test]
fn analytics_quality_is_not_flattened_into_a_number() {
    let projected = AnalyticsDataPoint {
        time: "2026-07-01T00:00:00Z".to_owned(),
        value: Some(12.0),
        string_values: Vec::new(),
        quality: Some(AnalyticsPointQuality::Projected),
    };
    let insufficient = AnalyticsDataPoint {
        quality: Some(AnalyticsPointQuality::Insufficient),
        ..projected.clone()
    };

    assert_eq!(
        analytics_status(&[projected], false),
        AnalyticsResultStatus::Projected
    );
    assert_eq!(
        analytics_status(&[insufficient], false),
        AnalyticsResultStatus::Insufficient
    );
}

#[test]
fn upload_limit_matches_roblox_place_publishing_limit() {
    assert_eq!(MAX_PLACE_BYTES, 10_485_760);
}

#[test]
fn introspection_requires_purpose_scopes_and_target_binding() {
    let document: IntrospectionDocument = serde_json::from_value(serde_json::json!({
        "name": "private alpha publish",
        "authorizedUserId": 123,
        "enabled": true,
        "expired": false,
        "scopes": [
            {"name":"universe-places","operations":["write"],"universeIds":["456"]},
            {"name":"universe.place","operations":["write"],"universeIds":["456"]}
        ]
    }))
    .unwrap();

    assert!(document.allows(CredentialPurpose::Publish, Some("456")));
    assert!(!document.allows(CredentialPurpose::Publish, Some("999")));
    assert!(!document.allows(CredentialPurpose::Analytics, Some("456")));
}

#[test]
fn wildcard_resource_scope_does_not_verify_an_exact_universe() {
    let document: IntrospectionDocument = serde_json::from_value(serde_json::json!({
        "name": "overbroad publish",
        "authorizedUserId": 123,
        "enabled": true,
        "expired": false,
        "scopes": [
            {"name":"universe-places","operations":["write"],"universeIds":["*"]},
            {"name":"universe.place","operations":["write"],"universeIds":["*"]}
        ]
    }))
    .unwrap();

    assert!(document.allows(CredentialPurpose::Publish, None));
    assert!(!document.allows(CredentialPurpose::Publish, Some("456")));
}

#[test]
fn disabled_or_expired_credentials_are_never_accepted() {
    for state in [
        serde_json::json!({"name":"disabled","authorizedUserId":1,"enabled":false,"expired":false,"scopes":[]}),
        serde_json::json!({"name":"expired","authorizedUserId":1,"enabled":true,"expired":true,"scopes":[]}),
    ] {
        let document: IntrospectionDocument = serde_json::from_value(state).unwrap();
        assert!(!document.allows(CredentialPurpose::Publish, None));
        assert!(!document.allows(CredentialPurpose::Analytics, None));
    }
}

#[test]
fn registry_round_trip_contains_bindings_but_never_key_material() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("authority.json");
    let store = RegistryStore::new(path.clone());
    let target = VerifiedRobloxTarget {
        id: "0f86df92-ed53-42be-96c1-75957e2c7101".to_owned(),
        label: "Owned obby".to_owned(),
        universe_id: "456".to_owned(),
        root_place_id: "789".to_owned(),
        publish_credential_alias: "publish-default".to_owned(),
        analytics_credential_alias: Some("analytics-default".to_owned()),
        verified_at: "2026-07-15T00:00:00.000Z".to_owned(),
        game_url: "https://www.roblox.com/games/start?placeId=789".to_owned(),
    };
    let document = RegistryDocument {
        schema_version: 1,
        credential_metadata: vec![CredentialMetadata {
            purpose: CredentialPurpose::Publish,
            alias: "publish-default".to_owned(),
            verified_at: "2026-07-15T00:00:00.000Z".to_owned(),
        }],
        targets: vec![target.clone()],
    };

    store.save(&document).unwrap();
    assert_eq!(store.load().unwrap(), document);
    let serialized = std::fs::read_to_string(path).unwrap();
    assert!(serialized.contains("publish-default"));
    assert!(serialized.contains("456"));
    assert!(!serialized.contains("x-api-key"));
    assert!(!serialized.contains("a234567890123456"));
    assert_eq!(store.find_target(&target.id).unwrap(), target);
}

#[test]
fn frontend_wire_contract_uses_exact_metric_and_status_casing() {
    assert_eq!(
        serde_json::to_value(AnalyticsMetric::PayingUsersCvr).unwrap(),
        serde_json::json!("PayingUsersCVR")
    );
    assert_eq!(
        serde_json::to_value(AnalyticsGranularity::OneDay).unwrap(),
        serde_json::json!("OneDay")
    );
    assert_eq!(
        serde_json::to_value(AnalyticsPointQuality::Insufficient).unwrap(),
        serde_json::json!("insufficient")
    );
    assert_eq!(
        serde_json::to_value(AnalyticsResultStatus::NoData).unwrap(),
        serde_json::json!("no_data")
    );
    assert_eq!(
        serde_json::to_value(CapabilityState::SetupRequired).unwrap(),
        serde_json::json!("setup_required")
    );
    assert_eq!(
        serde_json::to_value(CredentialPurpose::Publish).unwrap(),
        serde_json::json!("publish")
    );
}

#[test]
fn omitted_analytics_status_is_not_serialized_as_explicit_valid() {
    let omitted = AnalyticsDataPoint {
        time: "2026-07-01T00:00:00Z".to_owned(),
        value: Some(0.0),
        string_values: Vec::new(),
        quality: None,
    };
    let explicit_valid = AnalyticsDataPoint {
        quality: Some(AnalyticsPointQuality::Valid),
        ..omitted.clone()
    };

    let omitted_json = serde_json::to_value(omitted).unwrap();
    let explicit_json = serde_json::to_value(explicit_valid).unwrap();
    assert!(omitted_json.get("quality").is_none());
    assert_eq!(
        explicit_json.get("quality"),
        Some(&serde_json::json!("valid"))
    );
}
