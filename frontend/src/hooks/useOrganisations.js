import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { organisationsApi } from '../api/organisations';
import { useResourceMutation } from './useResourceMutation';

const KEYS = ['organisations', 'dashboard'];

export const useOrganisations = (params) =>
  useQuery({
    queryKey: ['organisations', params],
    queryFn: () => organisationsApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useOrganisationAdmins = (id) =>
  useQuery({
    queryKey: ['organisations', id, 'admins'],
    queryFn: () => organisationsApi.listAdmins(id),
    enabled: Boolean(id),
  });

export const useCreateOrganisation = () => useResourceMutation(organisationsApi.create, KEYS);
export const useUpdateOrganisation = () =>
  useResourceMutation(({ id, ...body }) => organisationsApi.update(id, body), KEYS);
export const useDeleteOrganisation = () => useResourceMutation((id) => organisationsApi.remove(id), KEYS);
export const useCreateOrgAdmin = () =>
  useResourceMutation(({ organisationId, ...body }) => organisationsApi.createAdmin(organisationId, body), KEYS);
export const useUpdateOrgAdmin = () =>
  useResourceMutation(
    ({ organisationId, adminId, ...body }) => organisationsApi.updateAdmin(organisationId, adminId, body),
    KEYS,
  );
