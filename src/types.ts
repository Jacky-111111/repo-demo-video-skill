export type Confidence = "high" | "medium" | "low";
export type Importance = "high" | "medium" | "low";
export type DemoMode = "draft" | "full";

export interface Evidence<T> {
  value: T;
  confidence: Confidence;
  source: string;
  notes?: string;
}

export interface DemoAction {
  type: "click" | "type" | "select" | "visit" | "wait" | "assert-visible";
  selector?: string;
  text?: string;
  route?: string;
  confidence?: Confidence;
  source?: string;
}

export interface DemoFeature {
  name: string;
  description: string;
  importance: Importance;
  confidence: Confidence;
  source: string;
  route?: string;
  actions?: DemoAction[];
}

export interface DemoConfig {
  projectName?: string;
  tagline?: string;
  demoUrl?: string;
  run?: {
    install?: string;
    start?: string;
    localUrl?: string;
  };
  features?: DemoFeature[];
  demoFlow?: string[];
  video?: {
    durationSeconds?: number;
    voice?: string;
    style?: string;
    includeSubtitles?: boolean;
  };
}

export interface LoadedDemoConfig {
  path?: string;
  config?: DemoConfig;
  warnings: string[];
}

export interface DemoGuide {
  path?: string;
  raw?: string;
  sections: Record<string, string>;
  projectName?: string;
  pitch?: string;
  demoUrl?: string;
  localRunCommands?: string[];
  keyFeatures?: string[];
  suggestedFlow?: string[];
  notes?: string;
  hasTestAccount: boolean;
}

export interface ReadmeFeature {
  name: string;
  description: string;
  sourceHeading: string;
}

export interface ReadmeAnalysis {
  path?: string;
  title?: string;
  summary?: string;
  blockquoteSummary?: string;
  sections: Record<string, string>;
  features: ReadmeFeature[];
  usageSteps: string[];
  urls: string[];
  warnings: string[];
}

export interface ProjectMetadata {
  repoPath: string;
  packageName?: string;
  packageDescription?: string;
  packageScripts: Record<string, string>;
  packageKeywords: string[];
  readmePath?: string;
  readmeTitle?: string;
  readmeSummary?: string;
  readmeUrls: string[];
  readme: ReadmeAnalysis;
  frameworks: string[];
  frameworkFiles: string[];
  sourceFiles: string[];
}

export interface InferredRoute {
  route: string;
  sourceFile: string;
  confidence: Confidence;
}

export interface ComponentHint {
  name: string;
  sourceFile: string;
  confidence: Confidence;
}

export interface RepoAnalysis {
  repoPath: string;
  config: LoadedDemoConfig;
  guide: DemoGuide;
  metadata: ProjectMetadata;
  projectName: Evidence<string>;
  tagline: Evidence<string>;
  targetAudience: Evidence<string>;
  coreProblem: Evidence<string>;
  demoUrl?: Evidence<string>;
  runCommand?: Evidence<string>;
  localUrl?: Evidence<string>;
  features: DemoFeature[];
  routes: InferredRoute[];
  components: ComponentHint[];
  missingInformation: string[];
  warnings: string[];
}

export interface DemoPlanStep {
  title: string;
  narrationGoal: string;
  route?: string;
  actions: DemoAction[];
  confidence: Confidence;
  source: string;
}

export interface DemoPlan {
  projectName: string;
  tagline: string;
  targetAudience: string;
  coreProblem: string;
  openingHook: string;
  selectedFeatures: DemoFeature[];
  browserSequence: DemoPlanStep[];
  closingPitch: string;
  confidenceSummary: {
    overall: Confidence;
    shouldGenerateFinalPlan: boolean;
    reasons: string[];
  };
  missingInformation: string[];
  sources: string[];
}

export interface SceneTiming {
  title: string;
  durationSeconds: number;
  maxNarrationWords: number;
}

export interface VideoTimingPlan {
  targetDurationSeconds: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  targetNarrationWords: number;
  minNarrationWords: number;
  maxNarrationWords: number;
  spokenWordsPerSecond: number;
  sceneCount: number;
  featuresToCover: number;
  sceneTimings: SceneTiming[];
  pacingWarnings: string[];
}

export interface CliOptions {
  repo: string;
  config?: string;
  url?: string;
  mode: DemoMode;
}

export interface BrowserRecordingResult {
  attempted: boolean;
  success: boolean;
  artifacts: string[];
  canonicalVideo?: string;
  observations: string[];
  warnings: string[];
}

export interface VoiceoverResult {
  success: boolean;
  mockMode: boolean;
  provider: "mock" | "openai";
  artifacts: string[];
  warnings: string[];
}

export interface VideoCompositionResult {
  status: "complete" | "partial" | "skipped" | "failed";
  success: boolean;
  artifact?: string;
  timing?: {
    audioDurationSeconds?: number;
    videoDurationSeconds?: number;
    extendedFinalFrameSeconds?: number;
  };
  deliverables: {
    browserRecordingWebm?: string;
    voiceoverAudio?: string;
    narratedMp4?: string;
    playbackHtml?: string;
  };
  warnings: string[];
}
