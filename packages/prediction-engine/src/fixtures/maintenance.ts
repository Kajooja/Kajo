import type { ArtifactVersion, DomainAdapter, Observation } from '../contracts.js';

interface MachineScope { machineId: string; operatorId: string; sessionId: string }
interface Configuration { id: string; load: number; availableAt: number; artifact: ArtifactVersion }
interface MeterReading {
  id: string; machineId: string; operatorId: string; configurationId: string;
  kwh: number | null; occurredAt: number; availableAt: number;
  actionId: string | null; predictionId: string | null;
}

/** Invented machine/configuration/energy observations: no real transfer claim. */
export const maintenanceAdapter: DomainAdapter<MachineScope, Configuration, MeterReading> = {
  version: 'synthetic-maintenance-v1',
  target: { id: 'fixture:energy-kwh', version: '1', scale: { min: 0, max: 100 },
    conditioning: 'action-outcome', exposure: 'required', objective: 'minimize' },
  encodeScope: input => ({ subject: { id: input.machineId, kind: 'system' }, actingIdentityRef: input.operatorId,
    sessionRef: input.sessionId, evidence: { sourceIds: ['maintenance-fixture'], cohortIds: [], synthetic: 'fixture-only' } }),
  encodeObject: input => ({ id: input.id, features: { load: input.load }, availableAt: input.availableAt, artifact: input.artifact }),
  interpretObservation(input): Observation {
    return { subjectId: input.machineId, actingIdentityRef: input.operatorId, objectId: input.configurationId,
      actionId: input.actionId, predictionId: input.predictionId,
      targetId: this.target.id, targetVersion: this.target.version,
      measurement: input.kwh === null ? { status: 'missing', reason: 'unknown' } : { status: 'observed', value: input.kwh },
      raw: { value: input.kwh, scale: this.target.scale }, occurredAt: input.occurredAt, availableAt: input.availableAt,
      exposure: 'verified', access: { kind: 'subject', subjectId: input.machineId },
      provenance: { origin: 'synthetic', source: { kind: 'generator', id: 'maintenance-fixture', version: '1', parentRefs: [] },
        recordId: input.id, revision: 1 } };
  },
  enumerateActions: objects => objects.map(object => ({ id: `configure:${object.id}`, kind: 'configure', object })),
  defineHardConstraints: (actions, excludedObjectIds) => ({ version: 'machine-safe-configurations-v1',
    allowedActionIds: actions.filter(a => !excludedObjectIds.includes(a.object.id)).map(a => a.id) }),
  calculateReward: observation => observation.measurement.status === 'observed' ? -observation.measurement.value : null,
};
