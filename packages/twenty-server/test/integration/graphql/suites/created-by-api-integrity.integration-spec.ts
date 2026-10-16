import { randomUUID } from 'node:crypto';

import { createManyOperationFactory } from 'test/integration/graphql/utils/create-many-operation-factory.util';
import { createOneOperationFactory } from 'test/integration/graphql/utils/create-one-operation-factory.util';
import { makeGraphqlApiRequest } from 'test/integration/graphql/utils/make-graphql-api-request.util';
import { updateManyOperationFactory } from 'test/integration/graphql/utils/update-many-operation-factory.util';
import { updateOneOperationFactory } from 'test/integration/graphql/utils/update-one-operation-factory.util';
import { deleteRecordsByIds } from 'test/integration/utils/delete-records-by-ids';
import { FieldActorSource } from 'twenty-shared/types';

import { WORKSPACE_MEMBER_DATA_SEED_IDS } from 'src/engine/workspace-manager/dev-seeder/data/constants/workspace-member-data-seeds.constant';

const ACTOR_GQL_FIELDS = `
  id
  name
  createdBy {
    source
    workspaceMemberId
    name
  }
  updatedBy {
    source
    workspaceMemberId
    name
  }
`;

const AUTHENTICATED_MEMBER_ACTOR = {
  source: FieldActorSource.MANUAL,
  workspaceMemberId: WORKSPACE_MEMBER_DATA_SEED_IDS.JANE,
  name: 'Jane Austen',
};

const FORGED_CREATED_BY = {
  source: FieldActorSource.MANUAL,
  workspaceMemberId: WORKSPACE_MEMBER_DATA_SEED_IDS.TIM,
  name: 'Tim Apple',
};

describe('createdBy API integrity', () => {
  const createdCompanyIds: string[] = [];

  afterAll(async () => {
    await deleteRecordsByIds('company', createdCompanyIds);
  });

  it('ignores a populated createdBy on createOne and stores the authenticated member', async () => {
    const companyId = randomUUID();

    createdCompanyIds.push(companyId);

    const response = await makeGraphqlApiRequest(
      createOneOperationFactory({
        objectMetadataSingularName: 'company',
        gqlFields: ACTOR_GQL_FIELDS,
        data: {
          id: companyId,
          name: 'Create one forged creator',
          createdBy: FORGED_CREATED_BY,
        },
      }),
    );

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.createCompany.createdBy).toEqual(
      AUTHENTICATED_MEMBER_ACTOR,
    );
    expect(response.body.data.createCompany.updatedBy).toEqual(
      AUTHENTICATED_MEMBER_ACTOR,
    );
  });

  it('ignores a populated createdBy on createMany and stores the authenticated member', async () => {
    const companyId = randomUUID();

    createdCompanyIds.push(companyId);

    const response = await makeGraphqlApiRequest(
      createManyOperationFactory({
        objectMetadataSingularName: 'company',
        objectMetadataPluralName: 'companies',
        gqlFields: ACTOR_GQL_FIELDS,
        data: [
          {
            id: companyId,
            name: 'Create many forged creator',
            createdBy: FORGED_CREATED_BY,
          },
        ],
      }),
    );

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.createCompanies).toEqual([
      expect.objectContaining({
        id: companyId,
        createdBy: AUTHENTICATED_MEMBER_ACTOR,
        updatedBy: AUTHENTICATED_MEMBER_ACTOR,
      }),
    ]);
  });

  it('keeps the original creator on updateOne while updating other fields and updatedBy', async () => {
    const companyId = randomUUID();

    createdCompanyIds.push(companyId);

    const createdResponse = await makeGraphqlApiRequest(
      createOneOperationFactory({
        objectMetadataSingularName: 'company',
        gqlFields: ACTOR_GQL_FIELDS,
        data: {
          id: companyId,
          name: 'Update one original',
        },
      }),
    );

    expect(createdResponse.body.errors).toBeUndefined();

    const updatedResponse = await makeGraphqlApiRequest(
      updateOneOperationFactory({
        objectMetadataSingularName: 'company',
        recordId: companyId,
        gqlFields: ACTOR_GQL_FIELDS,
        data: {
          name: 'Update one renamed',
          createdBy: FORGED_CREATED_BY,
        },
      }),
    );

    expect(updatedResponse.body.errors).toBeUndefined();
    expect(updatedResponse.body.data.updateCompany).toMatchObject({
      id: companyId,
      name: 'Update one renamed',
      createdBy: AUTHENTICATED_MEMBER_ACTOR,
      updatedBy: AUTHENTICATED_MEMBER_ACTOR,
    });
  });

  it('keeps the original creator on updateMany while updating other fields and updatedBy', async () => {
    const companyId = randomUUID();

    createdCompanyIds.push(companyId);

    const createdResponse = await makeGraphqlApiRequest(
      createOneOperationFactory({
        objectMetadataSingularName: 'company',
        gqlFields: 'id',
        data: {
          id: companyId,
          name: 'Update many original',
        },
      }),
    );

    expect(createdResponse.body.errors).toBeUndefined();

    const updatedResponse = await makeGraphqlApiRequest(
      updateManyOperationFactory({
        objectMetadataSingularName: 'company',
        objectMetadataPluralName: 'companies',
        gqlFields: ACTOR_GQL_FIELDS,
        filter: { id: { eq: companyId } },
        data: {
          name: 'Update many renamed',
          createdBy: FORGED_CREATED_BY,
        },
      }),
    );

    expect(updatedResponse.body.errors).toBeUndefined();
    expect(updatedResponse.body.data.updateCompanies).toEqual([
      expect.objectContaining({
        id: companyId,
        name: 'Update many renamed',
        createdBy: AUTHENTICATED_MEMBER_ACTOR,
        updatedBy: AUTHENTICATED_MEMBER_ACTOR,
      }),
    ]);
  });
});
