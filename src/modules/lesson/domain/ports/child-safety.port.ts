/**
 * Whether a child's own words say they may be in danger (#90). The check belongs to the guidance
 * module; this module only asks, before it reads a typed answer at all.
 */
export interface ChildSafetyPort {
  detectsDistress(text: string): boolean;
}
