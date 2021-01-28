import AcsPopulationProvider from "./variables/AcsPopulationProvider";
import VariableProvider from "./variables/VariableProvider";
import CovidProvider from "./variables/CovidProvider";
import BrfssProvider from "./variables/BrfssProvider";
import { MetricId } from "./MetricConfig";

export type ProviderId =
  | "acs_pop_provider"
  | "covid_provider"
  | "brfss_provider";

export default class VariableProviderMap {
  private providers: VariableProvider[];
  private providersById: Record<ProviderId, VariableProvider>;
  private metricsToProviderIds: Record<MetricId, ProviderId>;

  constructor() {
    const acsProvider = new AcsPopulationProvider();
    this.providers = [
      acsProvider,
      new CovidProvider(acsProvider),
      new BrfssProvider(),
    ];

    this.providersById = this.getProvidersById();
    this.metricsToProviderIds = this.getMetricsToProviderIdsMap();
  }

  private getProvidersById(): Record<ProviderId, VariableProvider> {
    const providersById: Partial<Record<
      ProviderId,
      VariableProvider
    >> = Object.fromEntries(this.providers.map((p) => [p.providerId, p]));
    return providersById as Record<ProviderId, VariableProvider>;
  }

  private getMetricsToProviderIdsMap(): Record<MetricId, ProviderId> {
    const metricsToProviderIds: Partial<Record<MetricId, ProviderId>> = {};
    this.providers.forEach((provider) => {
      provider.providesMetrics.forEach((varId) => {
        metricsToProviderIds[varId] = provider.providerId;
      });
    });
    return metricsToProviderIds as Record<MetricId, ProviderId>;
  }

  /**
   * Returns a list of all VariableProviders required to get the specified
   * variables.
   */
  getUniqueProviders(metricIds: MetricId[]): VariableProvider[] {
    // First, find the authoritative providers for each metric and dedupe them
    // in case multiple metrics are provided by the same provider.
    const providerIds = metricIds.map((id) => this.metricsToProviderIds[id]);
    const dedupedIds = Array.from(new Set(providerIds));
    const providers = dedupedIds.map((id) => this.providersById[id]);

    if (providers.length === 0) {
      throw new Error("No provider found for the requested metrics");
    }
    if (providers.length > 2) {
      // We don't support this because it results in non-deterministic outcomes
      // if different providers have the same secondary metrics.
      throw new Error(
        "Joining data from more than two providers is not supported"
      );
    }

    // Now, Check if one provider can handle the query entirely. If so, use
    // that. Otherwise, use all of them.
    const provider = providers.find((p) => p.canHandleAllMetrics(metricIds));
    return provider ? [provider] : providers;
  }
}
