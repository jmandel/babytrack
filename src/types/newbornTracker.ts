export {};

/**
 * @schema NewbornEvent
 * 
 * # Newborn Tracker Data Model
 * 
 * This documentation describes the data model used to track a variety of baby-care events in a newborn tracking application.
 * Each event is captured as a single object with a defined `eventType`, optional `subType`, and a `details` field specific to the event.
 * This model supports feeding, diaper changes, pumping, sleep and awake times, medical records, growth measurements, and baby milestones.
 * 
 * ## Overview
 * 
 * 1. **Event Types**  
 *    Each baby-care event is categorized under one of the `EventType` values:
 *    - `feeding`
 *    - `pumping`
 *    - `diaper`
 *    - `sleep`
 *    - `awake`
 *    - `medical`
 *    - `growth`
 *    - `milestone`
 * 
 * 2. **Sub-Types**  
 *    Within certain event types, we use a second discriminator to further refine the category:
 *    - **Feeding** uses `FeedingType` (`breast`, `bottle`, `formula`, `solids`).
 *    - **Medical** uses `MedicalEventType` (`medication`, `temperature`, `symptom`, `treatment`, `vaccination`).
 * 
 * 3. **Time Zone Guidance**
 *    Since we store timestamps in ISO8601 local time with offset:
 *    - Always include the local time zone offset in the timestamp, e.g. `2025-01-08T10:15:00-05:00`
 *    - When rendering data to the user, your application should:
 *      1. Parse the stored ISO8601 string
 *      2. Convert or display it in the user's local time zone as appropriate
 */

/**
 * Base event interface that all other event types extend.
 */
export interface BaseEvent {
  /**
   * Unique identifier for the event.
   * - For new events: DO NOT include this field
   * - For updates: MUST include this field
   */
  id?: string;

  /**
   * When the event occurred.
   * - Required for all events
   * - Use ISO-8601 format with timezone offset
   * - Defaults to current time if not specified
   */
  occurredAt: string;

  /**
   * When the event ended (for duration-based events).
   * - Optional
   * - Use ISO-8601 format with timezone offset
   * - Only used for events that have a duration (e.g., sleep, feeding)
   */
  endedAt?: string;

  /**
   * Additional notes or observations about the event.
   * - Optional
   * - Only include when explicitly provided
   * - Should contain user observations, not system actions
   * - Don't repeat information captured in other fields
   */
  notes?: string;

  /**
   * Who created this event
   * - Optional
   * - Used for audit/tracking
   */
  createdBy?: string;

  /**
   * Device identifier that created this event
   * - Optional
   * - Used for sync/conflict resolution
   */
  deviceId?: string;
}

/**
 * Enums for various event types and categories
 */
export enum FeedingType {
  Bottle = "BOTTLE",
  Nursing = "NURSING",
  Solids = "SOLIDS",
}

export enum BottleContentType {
  Formula = "FORMULA",
  BreastMilk = "BREAST_MILK",
  Water = "WATER",
  Fortifier = "FORTIFIER",
}

export enum SolidFoodConsistency {
  Puree = "PUREE",
  Mashed = "MASHED",
  Finger = "FINGER",
  Table = "TABLE",
}

export enum MeasurementUnit {
  KG = "kg",
  G = "g",
  CM = "cm",
  IN = "in",
  ML = "ml",
}

export enum DosageUnit {
  MG = "mg",
  ML = "ml",
  UNITS = "units",
}

export enum MedicalEventType {
  Medication = "MEDICATION",
  Temperature = "TEMPERATURE",
  Symptom = "SYMPTOM",
  Treatment = "TREATMENT",
  Vaccination = "VACCINATION",
}

export enum MeasurementType {
  Weight = "WEIGHT",
  Length = "LENGTH",
  HeadCircumference = "HEAD_CIRCUMFERENCE",
}

export enum PumpingMethod {
  Manual = "MANUAL",
  Electric = "ELECTRIC",
  Hakaa = "HAKAA",
}

export enum BreastSide {
  Left = "LEFT",
  Right = "RIGHT",
  Both = "BOTH",
}

/**
 * Feeding-related interfaces
 */
export interface BottleContent {
  type: BottleContentType;
  amountMl: number;
}

export interface BottleFeedingDetails {
  contents: BottleContent[];
  amountMlOffered: number;
  amountMlConsumed?: number;
}

export interface NursingAttempt {
  side: BreastSide;
  startedAt?: string;
  endedAt?: string;
  durationMinutes?: number;
  letdown?: boolean;
  goodLatch?: boolean;
}

export interface NursingDetails {
  attempts: NursingAttempt[];
}

export interface SolidFoodDetails {
  consistency: SolidFoodConsistency;
  foods: string[];
  acceptance: "none" | "some" | "most" | "all" | "refused";
  amountOffered?: string;
}

export interface BaseFeedingEvent extends BaseEvent {
  eventType: EventType.Feeding;
  subType: FeedingType;
  details: BottleFeedingDetails | NursingDetails | SolidFoodDetails;
}

export interface BottleFeedingEvent extends BaseFeedingEvent {
  subType: FeedingType.Bottle;
  details: BottleFeedingDetails;
}

export interface NursingFeedingEvent extends BaseFeedingEvent {
  subType: FeedingType.Nursing;
  details: NursingDetails;
}

export interface SolidsFeedingEvent extends BaseFeedingEvent {
  subType: FeedingType.Solids;
  details: SolidFoodDetails;
}

export type FeedingEvent = BottleFeedingEvent | NursingFeedingEvent | SolidsFeedingEvent;

/**
 * Pumping-related interfaces
 */
export interface PumpingDetails {
  side: BreastSide;
  durationMinutes: number;
  amountMl: number;
  letdown?: boolean;
  method?: PumpingMethod;
}

export interface PumpingEvent extends BaseEvent {
  eventType: EventType.Pumping;
  details: PumpingDetails;
}

/**
 * Diaper-related interfaces
 */
export interface UrineDetails {
  volume: "small" | "medium" | "large";
  color?: "clear" | "pale" | "dark" | "amber" | "other";
  concentrated?: boolean;
}

export interface StoolDetails {
  volume?: "small" | "medium" | "large";
  color?: "yellow" | "brown" | "green" | "black" | "red";
  consistency?: "watery" | "loose" | "soft" | "formed" | "hard" | "seedy" | "tarry";
  mucus?: boolean;
  blood?: boolean;
}

export interface DiaperCondition {
  rash?: {
    severity: "mild" | "moderate" | "severe";
    location: string[];
  };
  leakage?: boolean;
}

export interface DiaperEvent extends BaseEvent {
  eventType: EventType.Diaper;
  details: {
    urine?: UrineDetails;
    stool?: StoolDetails;
    condition?: DiaperCondition;
  };
}

/**
 * Sleep and Awake interfaces
 */
export interface SleepEvent extends BaseEvent {
  eventType: EventType.Sleep;
  details: {
    sleepLocation?: string;
  };
}

export interface AwakeEvent extends BaseEvent {
  eventType: EventType.Awake;
  details: {
    activity?: string;
    mood?: "happy" | "fussy" | "neutral";
  };
}

/**
 * Medical-related interfaces
 */
export interface BaseMedicalEvent extends BaseEvent {
  eventType: EventType.Medical;
  subType: MedicalEventType;
  details: any;
}

export interface MedicationEvent extends BaseMedicalEvent {
  subType: MedicalEventType.Medication;
  details: {
    medication: string;
    dosageAmount: number;
    dosageUnit: DosageUnit;
    route: "oral" | "topical" | "injection" | "other";
  };
}

export interface TemperatureEvent extends BaseMedicalEvent {
  subType: MedicalEventType.Temperature;
  details: {
    temperature: number;
    unit: "C" | "F";
    method: "oral" | "rectal" | "axillary" | "temporal";
  };
}

export interface SymptomEvent extends BaseMedicalEvent {
  subType: MedicalEventType.Symptom;
  details: {
    symptom: string;
    severity: "mild" | "moderate" | "severe";
    duration?: {
      value: number;
      unit: "minutes" | "hours" | "days";
    };
  };
}

export interface TreatmentEvent extends BaseMedicalEvent {
  subType: MedicalEventType.Treatment;
  details: {
    treatment: string;
    provider?: string;
    followUp?: string;
  };
}

export interface VaccinationEvent extends BaseMedicalEvent {
  subType: MedicalEventType.Vaccination;
  details: {
    vaccine: string;
    dose: number;
    site?: string;
    provider?: string;
  };
}

export type MedicalEvent =
  | MedicationEvent
  | TemperatureEvent
  | SymptomEvent
  | TreatmentEvent
  | VaccinationEvent;

/**
 * Growth-related interfaces
 */
export interface Measurement {
  type: MeasurementType;
  value: number;
  unit: MeasurementUnit;
}

export interface GrowthEvent extends BaseEvent {
  eventType: EventType.Growth;
  details: {
    measurements: Measurement[];
  };
}

/**
 * Milestone interface
 */
export interface MilestoneEvent extends BaseEvent {
  eventType: EventType.Milestone;
  details: {
    milestone: string;
    category?: "motor" | "cognitive" | "social" | "language";
  };
}

/**
 * @schema EventType
 * The type of event being logged.
 */
export enum EventType {
  Feeding = 'FEEDING',
  Pumping = 'PUMPING',
  Diaper = 'DIAPER',
  Sleep = 'SLEEP',
  Awake = 'AWAKE',
  Medical = 'MEDICAL',
  Growth = 'GROWTH',
  Milestone = 'MILESTONE'
}

/**
 * Master union type for all possible events
 */
export type NewbornEvent =
  | FeedingEvent
  | PumpingEvent
  | DiaperEvent
  | SleepEvent
  | AwakeEvent
  | MedicalEvent
  | GrowthEvent
  | MilestoneEvent; 