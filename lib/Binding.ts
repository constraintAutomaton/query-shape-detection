import { ContraintType, IContraint, IPredicate, IShape, OneOfPathIndexed } from "./Shape";
import { IStarPatternWithDependencies, type ITriple, Triple } from "./Triple";

/**
 * A binding from a query to a shape
 */
export interface IBindings {
    /**
     * Indicate if a star pattern is contained in a shape
     * @returns {boolean} indicate if the query is contained in a shape
     */
    isFullyBounded: () => boolean;
    /**
     * Indicate that the documents linked to the shapes should be visited if there are
     * complete or partial binding
     * @returns {boolean} indicate if the documents link to the shapes should be visited
     */
    shouldVisitShape: () => boolean;
    /**
     * 
     * Return the unbounded triples
     * @returns {ITriple[]} The binded triples 
     */
    getUnboundedTriple: () => ITriple[];
    /**
     * Return the bindings, the value is undefined if the triple cannot be bind to the shape
     * @returns {Map<string, ITriple | undefined>} the internal bindings
     */
    getBindings: () => Map<string, ITriple | undefined>;
    /**
     * Return the bind triple
     * @returns {ITriple[]} the bind triple
     */
    getBoundTriple: () => ITriple[];
    /**
     * Return the name of the decendent star pattern if the current star pattern is contained
     * @returns {[string, string | undefined][]} the star pattern name of the decendent if the current star pattern is contained
     */
    getNestedContainedStarPatternName: () => IDependentStarPattern[];
}

export interface IDependentStarPattern {
    starPattern: string;
    shape?: string[];
}

/**
 * Calculate the bindings from a shape and a query
 */
export class Bindings implements IBindings {
    // indexed by predicate
    private bindings = new Map<string, ITriple | undefined>();
    private unboundTriple: ITriple[] = [];
    private fullyBounded = false;
    private readonly closedShape: boolean;
    private nestedContainedStarPatternName: IDependentStarPattern[] = [];
    private nestedContainedStarPatternNameShapesContained = new Map<string, string[]>();
    private readonly oneOfs: OneOfBinding[];
    private unionBindings: UnionBinding[] = [];
    private shapePredicateBind = new Map<string, boolean>();
    private strict: boolean;

    public constructor(shape: IShape, starPattern: IStarPatternWithDependencies, linkedShape: Map<string, IShape>, unionStarPattern?: IStarPatternWithDependencies[][], strict?: boolean) {
        this.strict = strict ?? false;
        this.closedShape = shape.closed;
        for (const { triple } of starPattern.starPattern.values()) {
            this.bindings.set(triple.predicate, undefined);
        }
        for (const predicate of shape.getAll()) {
            this.shapePredicateBind.set(predicate.name, false);
        }
        this.oneOfs = shape.oneOfIndexed.map((oneOfs: OneOfPathIndexed[]) => new OneOfBinding(oneOfs));
        this.calculateBinding(shape, starPattern, linkedShape, unionStarPattern ?? []);

        // delete duplicate
        this.unboundTriple = Array.from(new Set(this.unboundTriple));
    }


    private calculateBinding(shape: IShape, starPattern: IStarPatternWithDependencies, linkedShape: Map<string, IShape>, unionStarPattern: IStarPatternWithDependencies[][]): void {
        for (const union of unionStarPattern) {
            this.unionBindings.push(new UnionBinding(shape, union, linkedShape));
        }
        const negatedTriples: ITriple[] = [];
        for (const { triple, dependencies } of starPattern.starPattern.values()) {
            if (!this.closedShape) {
                this.bindings.set(triple.predicate, triple);
                continue;
            }
            if (triple.predicate === Triple.NEGATIVE_PREDICATE_SET) {
                negatedTriples.push(triple);
                continue;
            }
            const singlePredicate = shape.get(triple.predicate);
            let predicates: IPredicate[] = [];
            for (const oneOfBinding of this.oneOfs) {
                const predicatesOneOf = oneOfBinding.get(triple.predicate);
                if (predicatesOneOf !== undefined) {
                    predicates = predicates.concat(predicatesOneOf);
                }
            }
            if (singlePredicate === undefined && predicates.length === 0) {
                this.unboundTriple.push(triple);
                continue;
            }
            if (singlePredicate !== undefined) {
                predicates.push(singlePredicate);
            }

            for (const predicate of predicates) {
                const constraint = predicate.constraint;

                if (this.strict && !Bindings.validateCardinality(triple, predicate)) {
                    this.unboundTriple.push(triple);
                    continue;
                }

                if (constraint === undefined) {
                    this.bindings.set(triple.predicate, triple);
                    this.shapePredicateBind.set(predicate.name, true);
                    continue;
                }

                if (this.handleShapeConstraint(constraint, triple, linkedShape, shape, dependencies)) {
                    continue;
                }

                if (this.handleShapeType(constraint, triple)) {
                    continue;
                }

                this.bindings.set(triple.predicate, triple);
                this.shapePredicateBind.set(predicate.name, true);
            }

        }
        if (!this.strict) {
            for (const triple of negatedTriples) {
                let hasBind = false;
                for (const [predicate, isBind] of this.shapePredicateBind) {
                    if (!isBind && !triple.negatedSet?.has(predicate)) {
                        this.bindings.set(triple.predicate, triple);
                        this.shapePredicateBind.set(predicate, true);
                        hasBind = true;
                        continue;
                    }
                }
                if (!hasBind) {
                    this.unboundTriple.push(triple);
                }
            }
        }

        if (shape.closed === false) {
            this.fullyBounded = starPattern.starPattern.size !== 0;
        } else {
            let boundedUnion = true;
            for (const unionBinding of this.unionBindings) {
                boundedUnion = ((unionBinding.hasOneContained && !this.strict) ||
                    (this.strict && unionBinding.areAllContained)) && boundedUnion;
            }
            this.fullyBounded = this.unboundTriple.length === 0 && starPattern.starPattern.size !== 0 && boundedUnion;
        }
        if (this.fullyBounded) {
            const cycle = new Set<string>();
            const rejectedValues = new Set<string>();
            const result = new Map<string, string[]>();
            this.fillNestedContainedStarPatternName(starPattern, cycle, starPattern.name, rejectedValues, result);
            for (const starPattern of rejectedValues) {
                result.delete(starPattern);
            }
            let nestedContainedStarPatternName: string[] = [];
            for (const nestedConstrainStarPattern of result.values()) {
                nestedContainedStarPatternName = nestedContainedStarPatternName.concat(nestedConstrainStarPattern);
            }
            // delete duplicate

            nestedContainedStarPatternName = Array.from(new Set(nestedContainedStarPatternName));
            this.nestedContainedStarPatternName = nestedContainedStarPatternName
                .map((starPattern) => {
                    return {
                        shape: this.nestedContainedStarPatternNameShapesContained.get(starPattern),
                        starPattern: starPattern
                    };
                });

        }
    }

    private fillNestedContainedStarPatternName(starPattern: IStarPatternWithDependencies, cycle: Set<string>, originalName: string, rejectedValues: Set<string>, result: Map<string, string[]>): void {
        for (const { dependencies } of starPattern.starPattern.values()) {
            if (dependencies !== undefined) {
                const currentBranch = result.get(starPattern.name);
                if (currentBranch !== undefined) {
                    currentBranch.push(dependencies.name);
                } else {
                    result.set(starPattern.name, [dependencies.name]);
                }
                if (result.has(dependencies.name)) {
                    cycle.add(dependencies.name);
                    cycle.add(starPattern.name);
                }
                // we don't make dependent star pattern directly cycled connected to the current star pattern
                if (result.has(dependencies.name) && dependencies.name === originalName) {
                    rejectedValues.add(dependencies.name);
                    rejectedValues.add(starPattern.name);
                }
                // to avoid infinite loop
                if (!cycle.has(dependencies.name)) {
                    this.fillNestedContainedStarPatternName(dependencies, cycle, originalName, rejectedValues, result);
                }
            }
        }

    }

    private handleShapeConstraint(
        constraint: IContraint,
        triple: ITriple,
        linkedShape: Map<string, IShape>,
        currentShape: IShape,
        dependencies?: IStarPatternWithDependencies): boolean {
        if (constraint.type === ContraintType.SHAPE && dependencies !== undefined && constraint.value.size == 1) {
            const shapeName: string = constraint.value.values().next().value;
            const currentLinkedShape = currentShape.name === shapeName ? currentShape : linkedShape.get(shapeName);
            if (currentLinkedShape === undefined) {
                this.bindings.set(triple.predicate, triple);
                return true;
            }

            const nestedBinding = new Bindings(currentLinkedShape, dependencies, linkedShape);
            if (nestedBinding.isFullyBounded()) {
                this.bindings.set(triple.predicate, triple);
                this.nestedContainedStarPatternNameShapesContained = new Map(
                    [
                        ...this.nestedContainedStarPatternNameShapesContained,
                        ...nestedBinding.nestedContainedStarPatternNameShapesContained
                    ]);
                const dependentShape = this.nestedContainedStarPatternNameShapesContained.get(dependencies.name);
                if (dependentShape === undefined) {
                    this.nestedContainedStarPatternNameShapesContained.set(dependencies.name, [currentLinkedShape.name]);
                } else {
                    dependentShape.push(currentLinkedShape.name);
                }
            } else {
                this.unboundTriple.push(triple);
            }
            return true;
        }

        return false
    }

    private handleShapeType(
        constraint: IContraint,
        triple: ITriple): boolean {
        if (constraint.type === ContraintType.TYPE &&
            !Array.isArray(triple.object) &&
            triple.object.termType === "Literal"
            && constraint.value.has(triple.object.datatype.value)
        ) {
            this.bindings.set(triple.predicate, triple);
            return true;
        } else if (constraint.type === ContraintType.TYPE &&
            !Array.isArray(triple.object) &&
            triple.object.termType === "NamedNode"
            && constraint.value.has(triple.object.value)) {
            this.bindings.set(triple.predicate, triple);
            return true;

        } else if (constraint.type === ContraintType.TYPE &&
            !Array.isArray(triple.object) &&
            triple.object.termType === "Literal"
            && !constraint.value.has(triple.object.datatype.value)) {
            this.unboundTriple.push(triple);
            return true;
        }
        else if (constraint.type === ContraintType.TYPE &&
            !Array.isArray(triple.object) &&
            triple.object.termType === "NamedNode"
            && !constraint.value.has(triple.object.value)) {
            this.unboundTriple.push(triple);
            return true;
        } else if (constraint.type === ContraintType.TYPE &&
            Array.isArray(triple.object)) {
            for (const object of triple.object) {
                if (constraint.value.has(object.value) || (object.termType === "Literal" && constraint.value.has(object.datatype.value))) {
                    this.bindings.set(triple.predicate, triple);
                    break;
                }
            }
            return true;
        }

        return false
    }

    private static validateCardinality(triple: ITriple, predicate: IPredicate): boolean {
        if (triple.cardinality !== undefined && predicate.cardinality === undefined) {
            return triple.cardinality.max === 1 && triple.cardinality.min === 1;
        }
        const maxTripleCardinality = triple.cardinality?.max ?? 1;
        const minTripleCardinality = triple.cardinality?.min ?? 1;

        const maxPredicateCardinality = predicate.cardinality?.max ?? 1;
        const minPredicateCardinality = predicate.cardinality?.min ?? 1;
        
        const withinMax: boolean = maxTripleCardinality===-1? maxPredicateCardinality===-1: maxTripleCardinality<= maxPredicateCardinality;
        const withinMin:boolean = minTripleCardinality>=minPredicateCardinality;

        return withinMax && withinMin;
    }


    public isFullyBounded(): boolean {
        return this.fullyBounded;
    }


    public getUnboundedTriple(): ITriple[] {
        return new Array(...this.unboundTriple);
    }

    public getBindings(): Map<string, ITriple | undefined> {
        return new Map(this.bindings);
    }

    public getBoundTriple(): ITriple[] {
        const resp: ITriple[] = [];
        for (const triple of this.bindings.values()) {
            if (triple !== undefined) {
                resp.push(triple);
            }
        }
        return resp;
    }

    public shouldVisitShape(): boolean {
        return this.getBoundTriple().length > 0;
    }
    public getNestedContainedStarPatternName(): IDependentStarPattern[] {
        return this.nestedContainedStarPatternName;
    }
}

export class OneOfBinding {
    private readonly paths: OneOfPathIndexed[];

    public constructor(paths: OneOfPathIndexed[]) {
        this.paths = paths;
    }

    public get(el: string): IPredicate[] | undefined {
        const resp = [];
        for (const path of this.paths) {
            const predicate = path.get(el);
            if (predicate !== undefined) {
                resp.push(predicate);
            }
        }
        return resp.length === 0 ? undefined : resp;
    }
}

export class UnionBinding {
    private readonly bindings: IBindings[];
    public readonly hasOneContained: boolean;
    public readonly areAllContained: boolean;

    public constructor(shape: IShape, union: IStarPatternWithDependencies[], linkedShape: Map<string, IShape>) {
        this.bindings = [];
        for (const starPattern of union) {
            this.bindings.push(new Bindings(shape, starPattern, linkedShape));
        }
        this.hasOneContained = this.determineHasOneAtLeastContainment();
        this.areAllContained = this.determineAllContained();

    }

    private determineHasOneAtLeastContainment(): boolean {
        let hasOneContainment = false;
        for (const binding of this.bindings) {
            hasOneContainment = hasOneContainment || binding.isFullyBounded();
        }
        return hasOneContainment;
    }

    private determineAllContained(): boolean {
        let hasOneContainment = true;
        for (const binding of this.bindings) {
            hasOneContainment = hasOneContainment && binding.isFullyBounded();
        }
        return hasOneContainment;
    }
}