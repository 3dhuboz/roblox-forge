pub const INTELLIGENCE_SCHEMA_DIALECT: &str = "https://json-schema.org/draft/2020-12/schema";
pub const CURRENT_SCHEMA_VERSION: &str = "1.0.0";
pub const SUPPORTED_SCHEMA_MAJOR: u64 = 1;
pub const COMMON_SCHEMA_ID: &str =
    "https://schemas.robloxforge.dev/intelligence/common.schema.json";

const SUPPORTED_SCHEMA_VERSIONS: &[&str] = &[CURRENT_SCHEMA_VERSION];

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ContractKind {
    Common,
    GameBrief,
    GameOperatingModel,
    DirectorProposal,
    Provenance,
    CorpusRecord,
    ReferenceAnalysis,
    RadarSnapshot,
    MonetizationOpportunitySignal,
    Recommendation,
}

impl ContractKind {
    pub const ALL: [Self; 10] = [
        Self::Common,
        Self::GameBrief,
        Self::GameOperatingModel,
        Self::DirectorProposal,
        Self::Provenance,
        Self::CorpusRecord,
        Self::ReferenceAnalysis,
        Self::RadarSnapshot,
        Self::MonetizationOpportunitySignal,
        Self::Recommendation,
    ];

    pub const fn schema_id(self) -> &'static str {
        match self {
            Self::Common => COMMON_SCHEMA_ID,
            Self::GameBrief => {
                "https://schemas.robloxforge.dev/intelligence/game-brief.v1.schema.json"
            }
            Self::GameOperatingModel => {
                "https://schemas.robloxforge.dev/intelligence/game-operating-model.v1.schema.json"
            }
            Self::DirectorProposal => {
                "https://schemas.robloxforge.dev/intelligence/director-proposal.v1.schema.json"
            }
            Self::Provenance => {
                "https://schemas.robloxforge.dev/intelligence/provenance.v1.schema.json"
            }
            Self::CorpusRecord => {
                "https://schemas.robloxforge.dev/intelligence/corpus-record.v1.schema.json"
            }
            Self::ReferenceAnalysis => {
                "https://schemas.robloxforge.dev/intelligence/reference-analysis.v1.schema.json"
            }
            Self::RadarSnapshot => {
                "https://schemas.robloxforge.dev/intelligence/radar-snapshot.v1.schema.json"
            }
            Self::MonetizationOpportunitySignal => "https://schemas.robloxforge.dev/intelligence/monetization-opportunity-signal.v1.schema.json",
            Self::Recommendation => {
                "https://schemas.robloxforge.dev/intelligence/recommendation.v1.schema.json"
            }
        }
    }

    pub const fn schema_source(self) -> &'static str {
        match self {
            Self::Common => include_str!("../../../schemas/intelligence/common.schema.json"),
            Self::GameBrief => {
                include_str!("../../../schemas/intelligence/game-brief.v1.schema.json")
            }
            Self::GameOperatingModel => {
                include_str!("../../../schemas/intelligence/game-operating-model.v1.schema.json")
            }
            Self::DirectorProposal => {
                include_str!("../../../schemas/intelligence/director-proposal.v1.schema.json")
            }
            Self::Provenance => {
                include_str!("../../../schemas/intelligence/provenance.v1.schema.json")
            }
            Self::CorpusRecord => {
                include_str!("../../../schemas/intelligence/corpus-record.v1.schema.json")
            }
            Self::ReferenceAnalysis => {
                include_str!("../../../schemas/intelligence/reference-analysis.v1.schema.json")
            }
            Self::RadarSnapshot => {
                include_str!("../../../schemas/intelligence/radar-snapshot.v1.schema.json")
            }
            Self::MonetizationOpportunitySignal => include_str!(
                "../../../schemas/intelligence/monetization-opportunity-signal.v1.schema.json"
            ),
            Self::Recommendation => {
                include_str!("../../../schemas/intelligence/recommendation.v1.schema.json")
            }
        }
    }
}

pub const fn supported_schema_versions() -> &'static [&'static str] {
    SUPPORTED_SCHEMA_VERSIONS
}
