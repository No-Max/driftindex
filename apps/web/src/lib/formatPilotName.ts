export function formatPilotName(pilot: { firstName: string; lastName: string }): string {
  return `${pilot.firstName} ${pilot.lastName}`.trim();
}
