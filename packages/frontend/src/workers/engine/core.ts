import { Cluster, IInsightSpace, Insight, Record } from 'visual-insights'
import { DataGraph } from 'visual-insights/build/esm/insights/InsightFlow/dataGraph';
import { ViewSpace } from 'visual-insights/build/esm/insights/InsightFlow/engine';
import { KNNClusterWorker } from 'visual-insights/build/esm/insights/workers/KNNCluster';
import { CorrelationCoefficient } from 'visual-insights/build/esm/statistics';
import { IRow } from '../../interfaces';
// import { entropy } from 'visual-insights/build/esm/statistics';
import { IVizSpace } from '../../store/exploreStore';
import { isSetEqual } from '../../utils';
import { intersect } from './utils';

const VIEngine = Insight.VIEngine;
export function entropyAcc (fl: number[]) {
    let total = 0;
    for (let i = 0; i < fl.length; i++) {
        total += fl[i];
    }
    let tLog = Math.log2(total);
    let ent = 0;
    for (let i = 0; i < fl.length; i++) {
        ent = ent + fl[i] * (Math.log2(fl[i]) - tLog) / total
    }
    return -ent;
}
function getFL (T: any[]): number[] {
    const counter: Map<any, number> = new Map();
    for (let t of T) {
        if (!counter.has(t)) {
            counter.set(t, 0)
        }
        counter.set(t, counter.get(t)! + 1);
    }
    return [...counter.values()]
}
// function disMic (X: any[], Y: any[]): number {
//     const fl = getFL(Y);
//     const ent = entropyAcc(fl);
//     const groups: Map<any, any[]> = new Map();
//     for (let t of X) {
//         if (!groups.has(t)) {
//             groups.set(t, [])
//         }
//         groups.get(t)!.push(t)
//     }
//     for (let g of groups.values()) {
//         const subEnt = 
//     }
// }
// function micCor (dataSource: IRow[], fieldX: string, fieldY: string) {
//     return gene
// }

type Edge = [[number, number], number];
type AdjList = Edge[];
/**
 * 
 * @param matrix adjmatrix
 */
function turnAdjMatrix2List(matrix: number[][]): AdjList {
  // only for the special matrix here(corelational matrix)
  let edges: AdjList = [];
  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      edges.push([[i, j], Math.abs(matrix[i][j])]);
    }
  }
  return edges
}

function find (parents: number[], n: number): number {
  return parents[n] === n ? n : parents[n] = find(parents, parents[n]);
}


function union (parents: number[], n1: number, n2: number): void {
  let p1 = find(parents, n1);
  let p2 = find(parents, n2);
  parents[p1] = p2;
  // I'm too tired. this is just a tmp lazy solution.... will be fixed later.
  // may check and prove whether it's necessary.
  find(parents, n1);
  find(parents, n2)
}

/**
 * maxiumn spanning tree
 * @param matrix adjmatrix
 * @param groupNumber number of group generated by clustering
 */
function linkEdge(matrix: number[][], threshold: number | undefined = 0): Map<number, number[]> {
  const edges = turnAdjMatrix2List(matrix);
  edges.sort((a, b) => b[1] - a[1]);
  const parents = matrix.map((m, i) => i);
  const ss = new Set();
  for (let edge of edges) {
        if (find(parents, edge[0][0]) !== find(parents, edge[0][1]) && !ss.has(edge[0][1]) && !ss.has(edge[0][0])) {
            ss.add(edge[0][0])
            ss.add(edge[0][1])
            union(parents, edge[0][0], edge[0][1]);
        }
        for (let i = 0; i < parents.length; i++) {
            parents[i] = find(parents, i)
        }
        if (edge[1] < threshold){
            break;
        }
  }
  let groups: Map<number, number[]> = new Map();
  for (let i = 0; i < parents.length; i++) {
    if (!groups.has(parents[i])) {
      groups.set(parents[i], []);
    }
    groups.get(parents[i])!.push(i);
  }
  return groups;
}
function getMeaSetsBasedOnClusterGroups(mat: number[][], measures: string[], correlation_threshold?: number, max_number_of_group: number | undefined = 3): string[][] {
    const soft_max_measures_in_view = 3;
    let correlationMatrix: number[][] = mat;
    let groups: string[][] = Cluster.kruskal({
      matrix: correlationMatrix,
      measures: measures,
      groupMaxSize: 0,
      threshold: correlation_threshold ? correlation_threshold : 0.5
    });
    return groups;
  }

function getDimClusterGroups(
    mat: number[][],
    dimensions: string[],
    threshold: number,
    max_number_of_group?: number
  ): string[][] {
    const maxDimNumberInView = 4;
    let dimCorrelationMatrix = mat;
    // groupMaxSize here means group number.
    let groups: string[][] = Cluster.kruskal({
      matrix: dimCorrelationMatrix,
      measures: dimensions,
      groupMaxSize: 0,
      threshold,
    });
    return groups;
}
class CustomDataGraph extends DataGraph {
    // clusterMGraph(dataSource: Record[], CORRELATION_THRESHOLD?: number): string[][] {
    //     const mat = this.MG;
    //     const measures = this.measures
    //     const groups = linkEdge(mat, CORRELATION_THRESHOLD || this.MEASURE_CORRELATION_THRESHOLD)
    //     let ans: string[][] = [];
    //     const groupValues = [...groups.values()]
    //     for (let meas of groupValues) {
    //         ans.push(meas.map(meaIndex => measures[meaIndex]))
    //     }
    //     return ans;
    // }
    public clusterMGraph(dataSource: Record[], CORRELATION_THRESHOLD?: number) {
        const { measures, MEASURE_CORRELATION_THRESHOLD } = this;
        // console.log(JSON.stringify(this.MG))
        this.MClusters = getMeaSetsBasedOnClusterGroups(
            this.MG,
            measures,
            CORRELATION_THRESHOLD || MEASURE_CORRELATION_THRESHOLD
        );
        // console.log(this.MClusters)
        return this.MClusters;
    }
    computeMGraph(dataSource: Record[], cc?: CorrelationCoefficient): number[][] {
        super.computeMGraph(dataSource, cc);
        for (let i = 0; i < this.MG.length; i++) {
            let maxIndex = 0;
            let maxVal = 0;
            for (let j = 0; j < this.MG.length; j++) {
                if (i === j) continue;
                if (this.MG[i][j] > maxVal) {
                    maxVal = Math.abs(this.MG[i][j]);
                    maxIndex = j;
                }
            }
            for (let j = 0; j < this.MG.length; j++) {
                this.MG[i][j] = 0;
            }
            if (maxVal > this.MEASURE_CORRELATION_THRESHOLD) {
                this.MG[i][maxIndex] = 1;
            }
        }
        // console.log(JSON.stringify(this.MG))
        return this.MG;
    }
    public clusterDGraph(dataSource: Record[], CORRELATION_THRESHOLD?: number) {
        const { dimensions, DIMENSION_CORRELATION_THRESHOLD } = this;
        // console.log(JSON.stringify(this.DG))
        this.DClusters = getDimClusterGroups(
            this.DG,
            dimensions,
            CORRELATION_THRESHOLD || DIMENSION_CORRELATION_THRESHOLD
        );
        // console.log(this.DClusters)
        return this.DClusters;
    }
    computeDGraph(dataSource: Record[], cc?: CorrelationCoefficient): number[][] {
        super.computeDGraph(dataSource, cc);
        for (let i = 0; i < this.DG.length; i++) {
            let maxIndex = 0;
            let maxVal = 0;
            for (let j = 0; j < this.DG.length; j++) {
                if (i === j) continue;
                if (this.DG[i][j] > maxVal) {
                    maxVal = Math.abs(this.DG[i][j]);
                    maxIndex = j;
                }
            }
            for (let j = 0; j < this.DG.length; j++) {
                this.DG[i][j] = 0;
            }
            if (maxVal > this.DIMENSION_CORRELATION_THRESHOLD) {
                this.DG[i][maxIndex] = 1;
            }
        }
        // console.log(JSON.stringify(this.DG))
        return this.DG;
    }
}
export class RathEngine extends VIEngine {
    public constructor() {
        super();
        this.workerCollection.register('clusters', KNNClusterWorker);
        this.workerCollection.enable('clusters', true);
        // this.DIMENSION_NUM_IN_VIEW = {
        //     MIN: 0,
        //     MAX: 3
        // }
        // vie.workerCollection.register('identity', identityWorker);
        // vie.workerCollection.enable(DefaultIWorker.outlier, false);
        // vie.workerCollection.enable(DefaultIWorker.trend, false);
    }
    public async createInsightSpaces(viewSpaces: ViewSpace[] = this.subSpaces): Promise<IInsightSpace[]> {
        const ansSpaces = await this.exploreViews(viewSpaces);
        this.insightSpaces = ansSpaces;
        return ansSpaces
    }
    // public buildGraph(): this {
    //     this.dataGraph = new CustomDataGraph(this.dimensions, this.measures);
    //     this.dataGraph.computeDGraph(this.dataSource);
    //     this.dataGraph.computeMGraph(this.dataSource);
    //     return this;
    // }
    public async scanDetail(viewSpace: ViewSpace) {
        const context = this;
        // @ts-ignore TODO: FIX this in visual insights
        const { cube, fieldDictonary } = context;
        const { dimensions, measures } = viewSpace;
        const cuboid = cube.getCuboid(viewSpace.dimensions);
        const aggData = cuboid.getAggregatedRows(measures, measures.map(() => 'sum'));
        const insightSpaces: IInsightSpace[] = []
        const taskPool: Promise<void>[] = [];
        this.workerCollection.each((iWorker, name) => {
            const task = async () => {
                const result = await iWorker(aggData, dimensions, measures, fieldDictonary, context);
                if (result) {
                    result.type = name;
                    insightSpaces.push(result)
                }
            }
            taskPool.push(task());
        })
        await Promise.all(taskPool);
        return insightSpaces
    }
    public async searchPointInterests(viewSpace: ViewSpace) {
        // const globalMeasures = this.measures;
        let ansSet: any[] = []
        if (viewSpace.dimensions.length > 0) {
            const cuboid = this.cube.getCuboid(viewSpace.dimensions);
            const globalDist = this.cube.getCuboid([]).getAggregatedRows(viewSpace.measures, viewSpace.measures.map(() => 'dist'));
            const localDist = cuboid.getAggregatedRows(viewSpace.measures, viewSpace.measures.map(() => 'dist'))
            if (globalDist.length === 0) return ansSet;
            const globalDistMapByMeasure: Map<string, number[]> = new Map();
            for (let mea of viewSpace.measures) {
                const _sum: number = globalDist[0][mea].reduce((total: number, value: number) => total + value, 0)
                const pbDist: number[] = globalDist[0][mea].map((v: number) => v / _sum)
                globalDistMapByMeasure.set(mea, pbDist);
            }
            for (let ld of localDist) {
                let EKL = 0;
                for (let mea of viewSpace.measures) {
                    let kl = 0;
                    const globalPbDist: number[] = globalDistMapByMeasure.get(mea)!;
                    const localDist: number[] = ld[mea];
                    const localSum: number = localDist.reduce((total, value) => total + value, 0);
                    for (let b = 0; b < globalPbDist.length; b++) {
                        const px = localDist[b] / localSum;
                        const py = globalPbDist[b]
                        if (px > 0 && py > 0) {
                            kl += px * Math.log2(px / py)
                        }
                    }
                    EKL += kl;
                }
                EKL /= viewSpace.measures.length
                ansSet.push({
                    ...ld,
                    kl: EKL
                })
            }
            
        //     for (let mea of viewSpace.measures) {
        //         const distList = localDist.map(r => ({
        //             // TODO: 讨论是否应当直接使用count
        //             // props: 节省计算量
        //             // cons: 强依赖于cube必须去计算count
        //             ...r,
        //             freq: r[mea].reduce((total: number, value: number) => total + value, 0),
        //             dist: r[mea]
        //         }))
        //         if (globalDist.length > 0) {
        //             const globalSum = globalDist[0][mea].reduce((total: number, value: number) => total + value, 0);
        //             const globalProbDist = globalDist[0][mea].map((v: number) => v / globalSum)
        //             for (let i = 0; i < distList.length; i++) {
        //                 let kl = 0;
        //                 for (let b = 0; b < distList[i].dist.length; b++) {
        //                     const px = distList[i].dist[b] / distList[i].freq
        //                     const py = globalProbDist[b];
        //                     if (px > 0 && py > 0) {
        //                         kl += px * Math.log2(px / py);
        //                     }
        //                 }
        //                 ansSet.push({
        //                     ...distList[i],
        //                     kl
        //                 })
        //             }
        //         }
        //     }
        } else {
            // todo
        }
        ansSet.sort((a, b) => b.kl - a.kl)
        return ansSet
    }
    public async associate(space: { dimensions: string[]; measures: string[] }) {
        const { insightSpaces } = this;
        const { dimensions, measures, dataGraph } = this;
        // type1: meas cor assSpacesT1
        // type2: dims cor assSpacesT2
        // this.vie.dataGraph.DG
        const dimIndices = space.dimensions.map(f => dimensions.findIndex(d => f === d));
        const meaIndices = space.measures.map(f => measures.findIndex(m => f === m));
        const assSpacesT1: IVizSpace[] = [];
        const assSpacesT2: IVizSpace[] = [];
        for (let i = 0; i < insightSpaces.length; i++) {
            // if (i === spaceIndex) continue;
            if (!intersect(insightSpaces[i].dimensions, space.dimensions)) continue;
            if (isSetEqual(insightSpaces[i].measures, space.measures)) continue;
            if (!isSetEqual(insightSpaces[i].dimensions, space.dimensions)) continue;
            let t1_score = 0;
            const iteMeaIndices = insightSpaces[i].measures.map(f => measures.findIndex(m => f === m));
            if (dataGraph !== null) {
                for (let j = 0; j < meaIndices.length; j++) {
                    for (let k = 0; k < iteMeaIndices.length; k++) {
                        t1_score += dataGraph.MG[meaIndices[j]][iteMeaIndices[k]]
                    }
                }
            }
            t1_score /= (meaIndices.length * iteMeaIndices.length)
            if (t1_score > 0.7) {
                const card = insightSpaces[i].dimensions.map(d => this.fields.find(f => f.key === d))
                .filter(f => f !== undefined)
                .map(f => Number(f?.features.unique))
                .reduce((t, v) => t * v, 1)
                const spec = this.specification(insightSpaces[i])
                if (spec) {
                    // assSpacesT1.push({
                    //     schema: spec.schema,

                    // })
                    assSpacesT1.push({
                        ...insightSpaces[i],
                        score: t1_score / card / iteMeaIndices.length,
                        card,
                        // ...spec,
                        schema: spec.schema,
                        dataView: spec.dataView
                    })
                }
            }
        }
        for (let i = 0; i < insightSpaces.length; i++) {
            // if (i === spaceIndex) continue;
            if (!intersect(insightSpaces[i].measures, space.measures)) continue;
            if (isSetEqual(insightSpaces[i].dimensions, space.dimensions)) continue;
            // if (!isSetEqual(insightSpaces[i].measures, space.measures)) continue;
            let t1_score = 0;
            const iteDimIndices = insightSpaces[i].dimensions.map(f => dimensions.findIndex(m => f === m));
            if (dataGraph !== null) {
                for (let j = 0; j < dimIndices.length; j++) {
                    for (let k = 0; k < iteDimIndices.length; k++) {
                        t1_score += dataGraph.DG[dimIndices[j]][iteDimIndices[k]]
                    }
                }
            }
            t1_score /= (dimIndices.length * iteDimIndices.length)
            if (t1_score > 0.35) { // (1 + 0.3) / 2
                const card = insightSpaces[i].dimensions.map(d => this.fields.find(f => f.key === d))
                .filter(f => f !== undefined)
                .map(f => Number(f?.features.unique))
                // .reduce((t, v) => t * v, 1)
                .reduce((t, v) => t + v, 0)
                const spec = this.specification(insightSpaces[i])
                if (spec) {
                    assSpacesT2.push({
                        ...insightSpaces[i],
                        score: t1_score / card,
                        card,
                        ...spec
                    })
                }
            }
        }
        // assSpacesT1.sort((a, b) => (b.score || 0) / (b.impurity || 0) - (a.score || 0) / (a.impurity || 0))
        // assSpacesT2.sort((a, b) => (b.score || 0) / (b.impurity || 0) - (a.score || 0) / (a.impurity || 0))
        assSpacesT1.sort((a, b) => (b.score || 0) - (a.score || 0))
        assSpacesT2.sort((a, b) => (b.score || 0) - (a.score || 0))
        return {
            assSpacesT1,
            assSpacesT2
        }
    }
    public async exploreViews(viewSpaces: ViewSpace[] = this.subSpaces): Promise<IInsightSpace[]> {
        // console.log(JSON.stringify(this.dimensions), JSON.stringify(this.dataGraph.DG), JSON.stringify(this.dataGraph.DClusters), JSON.stringify(this.dataGraph.dimensions))
        // console.log(this.dataGraph.dimensions.map(d => this.fields.find(f => f.key === d)!.name))
        const context = this;
        const DEFAULT_BIN_NUM = 16;
        const { measures: globalMeasures, fieldDictonary } = context
        let ansSpace: IInsightSpace[] = [];
        const globalDist = context.cube.getCuboid([]).getAggregatedRows(globalMeasures, globalMeasures.map(() => 'dist'));
        for (let measures of context.dataGraph.MClusters) {
            // const ent = 
            let totalEntLoss = 0;
            for (let mea of measures) {
                let ent = 0;
                if (globalDist.length > 0) {
                    ent = entropyAcc(globalDist[0][mea].filter((d: number) => d > 0))
                }
                totalEntLoss += (Math.log2(DEFAULT_BIN_NUM) - ent) / Math.log2(DEFAULT_BIN_NUM)
            }
            totalEntLoss /= measures.length;
            
            ansSpace.push({
                dimensions: [],
                measures: measures,
                significance: 1,
                score: totalEntLoss,
                impurity: totalEntLoss
            })
        }
        for (let space of viewSpaces) {
            const { dimensions, measures } = space;
            let dropSpace = false;
            const localDist = context.cube.getCuboid(dimensions).getAggregatedRows(measures, measures.map(() => 'dist'));
            let totalEntLoss = 0;
            for (let mea of measures) {
                let ent = 0;
                if (globalDist.length > 0) {
                    ent = entropyAcc(globalDist[0][mea].filter((d: number) => d > 0))
                }
                let conEnt = 0;
                // let tEnt = 0;
                if (!fieldDictonary.has(mea)) {
                    continue;
                }
                const totalCount = fieldDictonary.get(mea)!.features.size;
                const distList = localDist.map(r => ({
                    // TODO: 讨论是否应当直接使用count
                    // props: 节省计算量
                    // cons: 强依赖于cube必须去计算count
                    freq: r[mea].reduce((total: number, value: number) => total + value, 0),
                    dist: r[mea]
                }))
                const useNestInfluence = false;
                // tEnt = entropy(distList.map(d => d.freq).filter(f => f > 0))
                distList.sort((a, b) => b.freq - a.freq);
                for (let i = 0; i < distList.length; i++) {
                    if (i >= DEFAULT_BIN_NUM - 1) break;
                    if (useNestInfluence && distList[i].freq < DEFAULT_BIN_NUM) {
                        conEnt += (distList[i].freq / totalCount) * ent
                    } else {
                        const subEnt1 = entropyAcc(distList[i].dist.filter((d: number) => d > 0));
                        conEnt += (distList[i].freq / totalCount) * subEnt1
                    }
                }
                const noiseGroup = new Array(DEFAULT_BIN_NUM).fill(0);
                let noiseFre = 0;
                for (let i = DEFAULT_BIN_NUM - 1; i < distList.length; i++) {
                    for (let j = 0; j < noiseGroup.length; j++) {
                        noiseGroup[j] += distList[i].dist[j];    
                    }
                    noiseFre += distList[i].freq;
                }
                if (noiseFre > 0) {
                    if (useNestInfluence && noiseFre < DEFAULT_BIN_NUM) {
                        conEnt += (noiseFre / totalCount) * ent;
                    } else {
                        conEnt += (noiseFre / totalCount) * entropyAcc(noiseGroup.filter(d => d > 0));
                    }
                }
                totalEntLoss += (ent - conEnt) / Math.log2(Math.min(DEFAULT_BIN_NUM, distList.length))
                // totalEntLoss += (ent - conEnt) / Math.log2(DEFAULT_BIN_NUM)
                // totalEntLoss += (ent - conEnt) / Math.min(DEFAULT_BIN_NUM, distList.length)
                if ((ent - conEnt) / ent < 0.005) {
                    dropSpace = true;
                    break;
                }
            }
            totalEntLoss /= measures.length;
            if (dropSpace) continue;
            ansSpace.push({
                dimensions,
                measures,
                significance: 1,
                score: totalEntLoss,
                impurity: totalEntLoss
            })
        }
        ansSpace.sort((a, b) => Number(b.score) - Number(a.score));
        return ansSpace;
    }
}