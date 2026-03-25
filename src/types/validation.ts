export type Severity = "error" | "warning" | "info";

export interface ValidationIssue {
  id: string;
  severity: Severity;
  message: string;
  location?: string;
  autoFixable: boolean;
  fixDescription?: string;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
}
