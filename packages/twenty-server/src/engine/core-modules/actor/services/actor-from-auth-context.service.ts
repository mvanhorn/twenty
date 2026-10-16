import { Injectable } from '@nestjs/common';
import { isNonEmptyString } from '@sniptt/guards';

import { type ActorMetadata, type FieldActorSource } from 'twenty-shared/types';
import { isDefined, isPlainObject } from 'twenty-shared/utils';

import { buildActorMetadataFromAuthContext } from 'src/engine/core-modules/actor/utils/build-actor-metadata-from-auth-context.util';
import { isUserAuthContext } from 'src/engine/core-modules/auth/guards/is-user-auth-context.guard';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { WorkspaceManyOrAllFlatEntityMapsCacheService } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service';
import { findFlatEntityByIdInFlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util';
import { buildFieldMapsFromFlatObjectMetadata } from 'src/engine/metadata-modules/flat-field-metadata/utils/build-field-maps-from-flat-object-metadata.util';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';

export type RecordInput = Record<string, unknown>;

type ActorFieldInput = {
  source?: FieldActorSource;
  workspaceMemberId?: string | null;
  name?: string;
  context?: ActorMetadata['context'];
};

export type InjectActorParams = {
  records: RecordInput[];
  objectMetadataNameSingular: string;
  authContext: WorkspaceAuthContext;
};

@Injectable()
export class ActorFromAuthContextService {
  constructor(
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
  ) {}

  async injectCreatedBy({
    records,
    objectMetadataNameSingular,
    authContext,
  }: InjectActorParams): Promise<RecordInput[]> {
    return this.injectActorField({
      records,
      objectMetadataNameSingular,
      authContext,
      fieldName: 'createdBy',
    });
  }

  async injectActorFieldsOnCreate({
    records,
    objectMetadataNameSingular,
    authContext,
  }: InjectActorParams): Promise<RecordInput[]> {
    const recordsWithCreatedBy = await this.injectActorField({
      records,
      objectMetadataNameSingular,
      authContext,
      fieldName: 'createdBy',
    });

    return await this.injectActorField({
      records: recordsWithCreatedBy,
      objectMetadataNameSingular,
      authContext,
      fieldName: 'updatedBy',
    });
  }

  async injectUpdatedBy({
    records,
    objectMetadataNameSingular,
    authContext,
  }: InjectActorParams): Promise<RecordInput[]> {
    return this.injectActorField({
      records: this.omitCreatedByOnUserUpdate(records, authContext),
      objectMetadataNameSingular,
      authContext,
      fieldName: 'updatedBy',
    });
  }

  private omitCreatedByOnUserUpdate(
    records: RecordInput[],
    authContext: WorkspaceAuthContext,
  ): RecordInput[] {
    if (!isUserAuthContext(authContext)) {
      return records;
    }

    return records.map((record) => {
      if (!('createdBy' in record)) {
        return record;
      }

      const { createdBy: _createdBy, ...recordWithoutCreatedBy } = record;

      return recordWithoutCreatedBy;
    });
  }

  private async injectActorField({
    records,
    objectMetadataNameSingular,
    authContext,
    fieldName,
  }: InjectActorParams & { fieldName: 'createdBy' | 'updatedBy' }): Promise<
    RecordInput[]
  > {
    const workspace = authContext.workspace;

    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId: workspace.id,
          flatMapsKeys: ['flatObjectMetadataMaps', 'flatFieldMetadataMaps'],
        },
      );

    const { idByNameSingular } = buildObjectIdByNameMaps(
      flatObjectMetadataMaps,
    );
    const objectId = idByNameSingular[objectMetadataNameSingular];
    const objectMetadata = objectId
      ? findFlatEntityByIdInFlatEntityMaps({
          flatEntityId: objectId,
          flatEntityMaps: flatObjectMetadataMaps,
        })
      : undefined;

    const fieldIdByName = objectMetadata
      ? buildFieldMapsFromFlatObjectMetadata(
          flatFieldMetadataMaps,
          objectMetadata,
        ).fieldIdByName
      : {};

    if (!isDefined(fieldIdByName[fieldName])) {
      return records;
    }

    const clonedRecords = structuredClone(records);

    const actorMetadata = buildActorMetadataFromAuthContext(authContext);

    for (const record of clonedRecords) {
      this.injectActorToRecord(actorMetadata, record, fieldName, authContext);
    }

    return clonedRecords;
  }

  private injectActorToRecord(
    actorMetadata: ActorMetadata,
    record: RecordInput,
    fieldName: 'createdBy' | 'updatedBy',
    authContext: WorkspaceAuthContext,
  ) {
    if (fieldName === 'updatedBy') {
      record[fieldName] = actorMetadata;

      return;
    }

    // Session name and member id win for a signed-in member.
    // An explicit source still stands for import, workflow, and agent creates.
    if (isUserAuthContext(authContext)) {
      record[fieldName] = this.resolveCreatedByForUser(
        actorMetadata,
        this.readActorFieldInput(record[fieldName]),
      );

      return;
    }

    const existingValue = record[fieldName] as ActorMetadata | undefined;

    if (actorMetadata && (!existingValue || !existingValue.name)) {
      record[fieldName] = {
        ...actorMetadata,
        source: existingValue?.source ?? actorMetadata.source,
      };
    }
  }

  private resolveCreatedByForUser(
    actorMetadata: ActorMetadata,
    existingValue: ActorFieldInput | undefined,
  ): ActorMetadata {
    if (!isDefined(existingValue)) {
      return actorMetadata;
    }

    const attributesAnotherMember =
      isDefined(existingValue.workspaceMemberId) &&
      existingValue.workspaceMemberId !== actorMetadata.workspaceMemberId;

    const createdBy: ActorMetadata = {
      ...actorMetadata,
      source: existingValue.source ?? actorMetadata.source,
    };

    if (
      !attributesAnotherMember &&
      isNonEmptyString(existingValue.name) &&
      isDefined(existingValue.context)
    ) {
      createdBy.context = existingValue.context;
    }

    return createdBy;
  }

  private readActorFieldInput(value: unknown): ActorFieldInput | undefined {
    if (!isPlainObject(value)) {
      return undefined;
    }

    return value as ActorFieldInput;
  }
}
