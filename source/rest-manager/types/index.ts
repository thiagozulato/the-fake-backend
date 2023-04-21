export type FilterRouteQuery = {
  path: string;
};

export type FilterMockResponseQuery = {
  path: string;
  type: string;
  overrideName: string;
};

export type UseRouteOverride = {
  path: string;
  type: string;
  name: string;
};
