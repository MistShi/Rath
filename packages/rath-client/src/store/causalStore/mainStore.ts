import { action, makeAutoObservable, observable, runInAction, toJS } from "mobx";
import { notify } from "../../components/error";
import type { PAG_NODE } from "../../pages/causal/config";
import { getCausalModelStorage, getCausalModelStorageKeys, setCausalModelStorage } from "../../utils/storage";
import type { DataSourceStore } from "../dataSourceStore";
import CausalDatasetStore from "./datasetStore";
import CausalModelStore from "./modelStore";
import CausalOperatorStore from "./operatorStore";
import { resolveCausality } from "./pag";


export interface ICausalStoreSave {
    readonly datasetId: string;
    readonly fields: readonly string[];
    readonly causalModel: {
        readonly algorithm: string;
        readonly params: { readonly [key: string]: any };
        readonly causalityRaw: readonly (readonly PAG_NODE[])[];
    } | null;
}

export default class CausalStore {

    public dataset: CausalDatasetStore;
    public operator: CausalOperatorStore;
    public model: CausalModelStore;

    public get fields() {
        return this.dataset.fields;
    }

    public get data() {
        return this.dataset.sample;
    }

    public destroy() {
        this.model.destroy();
        this.operator.destroy();
        this.dataset.destroy();
    }

    public saveKeys: string[] = [];

    readonly checkout: (saveKey: string) => Promise<boolean>;

    public async save(): Promise<boolean> {
        if (!this.dataset.datasetId) {
            return false;
        }
        const save: ICausalStoreSave = {
            datasetId: this.dataset.datasetId,
            fields: this.fields.map(f => f.fid),
            causalModel: this.operator.algorithm && this.model.causalityRaw ? {
                algorithm: this.operator.algorithm,
                params: this.operator.params[this.operator.algorithm],
                causalityRaw: this.model.causalityRaw,
            } : null,
        };
        await setCausalModelStorage(this.dataset.datasetId, toJS(save));
        return true;
    }

    public async updateSaveKeys() {
        const modelKeys = await getCausalModelStorageKeys();
        runInAction(() => {
            this.saveKeys = modelKeys;
        });
    }

    constructor(dataSourceStore: DataSourceStore) {
        this.dataset = new CausalDatasetStore(dataSourceStore);
        this.operator = new CausalOperatorStore(dataSourceStore);
        this.model = new CausalModelStore(this.dataset, this.operator);

        this.checkout = async (saveKey: string) => {
            this.destroy();
            this.dataset = new CausalDatasetStore(dataSourceStore);
            this.operator = new CausalOperatorStore(dataSourceStore);
            this.model = new CausalModelStore(this.dataset, this.operator);
            const save = await getCausalModelStorage(saveKey);
            if (save) {
                if (save.datasetId !== this.dataset.datasetId) {
                    notify({
                        type: 'error',
                        title: 'Load Causal Model Failed',
                        content: `Dataset ID not match\nrequires: ${save.datasetId}\n: current:${this.dataset.datasetId}.`,
                    });
                    return false;
                }
                const droppedFields = save.fields.filter(fid => {
                    return this.dataset.allFields.findIndex(f => f.fid === fid) === -1;
                });
                if (droppedFields.length > 0) {
                    notify({
                        type: 'error',
                        title: 'Load Causal Model Failed',
                        content: `${droppedFields.length} fields not found: ${droppedFields.join(', ')}.`,
                    });
                    return false;
                }
                this.dataset.selectFields(save.fields.map(
                    fid => this.dataset.allFields.findIndex(f => f.fid === fid)
                ));
                if (save.causalModel) {
                    if (save.causalModel.algorithm in this.operator.params) {
                        this.operator.updateConfig(save.causalModel.algorithm, save.causalModel.params);
                    } else {
                        notify({
                            type: 'error',
                            title: 'Load Causal Model Failed',
                            content: `Algorithm ${save.causalModel.algorithm} is not supported.`,
                        });
                        return false;
                    }
                    runInAction(() => {
                        this.model.causalityRaw = save.causalModel!.causalityRaw;
                        this.model.causality = resolveCausality(save.causalModel!.causalityRaw, this.dataset.fields);
                    });
                }
                return true;
            }
            notify({
                type: 'error',
                title: 'Load Causal Model Failed',
                content: `Save id ${saveKey} fields not found.`,
            });
            return false;
        };
        
        makeAutoObservable(this, {
            dataset: observable.ref,
            operator: observable.ref,
            model: observable.ref,
            checkout: action,
        });
    }

    public selectFields(...args: Parameters<CausalDatasetStore['selectFields']>) {
        this.dataset.selectFields(...args);
    }

    public appendFilter(...args: Parameters<CausalDatasetStore['appendFilter']>) {
        this.dataset.appendFilter(...args);
    }

    public removeFilter(...args: Parameters<CausalDatasetStore['removeFilter']>) {
        this.dataset.removeFilter(...args);
    }

    public async run() {
        runInAction(() => {
            this.model.causalityRaw = null;
            this.model.causality = null;
        });
        const result = await this.operator.causalDiscovery(
            this.dataset.sample,
            this.dataset.fields,
            this.model.functionalDependencies,
            this.model.assertionsAsPag,
        );
        runInAction(() => {
            this.model.causalityRaw = result?.raw ?? null;
            this.model.causality = result?.pag ?? null;
        });

        return result;
    }

    public async computeMutualMatrix() {
        runInAction(() => {
            this.model.mutualMatrix = null;
        });
        const result = await this.operator.computeMutualMatrix(this.dataset.sample, this.dataset.fields);
        runInAction(() => {
            this.model.mutualMatrix = result;
        });
        return result;
    }

    public async computeCondMutualMatrix() {
        if (!this.model.mutualMatrix) {
            await this.computeMutualMatrix();
        }
        const { mutualMatrix } = this.model;
        if (!mutualMatrix) {
            return null;
        }
        runInAction(() => {
            this.model.condMutualMatrix = null;
        });
        const result = await this.operator.computeCondMutualMatrix(this.dataset.sample, this.dataset.fields, mutualMatrix);
        runInAction(() => {
            this.model.condMutualMatrix = result;
        });
        return result;
    }

}
