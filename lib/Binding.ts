import { ContraintType, IContraint, IShape } from "./Shape";
import { IStarPatternWithDependencies, type ITriple } from "./Triple";

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
     * @returns {string} the star pattern name of the decendent if the current star pattern is contained
     */
    getNestedContainedStarPatternName: () => string[];
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
    private nestedContainedStarPatternName: string[] = [];

    public constructor(shape: IShape, starPattern: IStarPatternWithDependencies, linkedShape: Map<string, IShape>) {
        this.closedShape = shape.closed;
        for (const { triple } of starPattern.starPattern.values()) {
            this.bindings.set(triple.predicate, undefined);
        }
        this.calculateBinding(shape, starPattern, linkedShape);
    }


    private calculateBinding(shape: IShape, starPattern: IStarPatternWithDependencies, linkedShape: Map<string, IShape>) {
        for (const { triple, dependencies } of starPattern.starPattern.values()) {
            if (!this.closedShape) {
                this.bindings.set(triple.predicate, triple);
                continue;
            }
            const predicate = shape.get(triple.predicate);
            if (predicate === undefined) {
                this.unboundTriple.push(triple);
                continue;
            }
            const constraint = predicate.constraint;
            if (constraint === undefined) {
                this.bindings.set(triple.predicate, triple);
                continue;
            }

            if (this.handleShapeConstraint(constraint, triple, linkedShape, dependencies)) {
                continue;
            }

            if (this.handleShapeType(constraint, triple)) {
                continue;
            }

            this.bindings.set(triple.predicate, triple);
        }

        if (shape.closed === false) {
            this.fullyBounded = starPattern.starPattern.size !== 0;
        } else {
            this.fullyBounded = this.unboundTriple.length === 0 && starPattern.starPattern.size !== 0;
        }
        if (this.fullyBounded) {
            const cycle: Set<string> = new Set();
            const rejectedValues: Set<string> = new Set();
            const result: Map<string, string[]> = new Map();
            this.fillNestedContainedStarPatternName(starPattern, cycle, starPattern.name, rejectedValues, result);
            for (const starPattern of rejectedValues) {
                result.delete(starPattern);
            }
            for (const [_, nestedConstrainStarPattern] of result) {
                this.nestedContainedStarPatternName = this.nestedContainedStarPatternName.concat(nestedConstrainStarPattern);
            }
            // delete duplicate
            this.nestedContainedStarPatternName = Array.from(new Set(this.nestedContainedStarPatternName));
        }
    }

    private fillNestedContainedStarPatternName(starPattern: IStarPatternWithDependencies, cycle: Set<string>, originalName: string, rejectedValues: Set<string>, result: Map<string, string[]>) {
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
                if(result.has(dependencies.name) && dependencies.name === originalName){
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
        dependencies?: IStarPatternWithDependencies): boolean {
        if (constraint.type === ContraintType.SHAPE && dependencies !== undefined && constraint.value.size == 1) {
            const shapeName: string = constraint.value.values().next().value;
            const currentLinkedShape = linkedShape.get(shapeName);
            if (currentLinkedShape === undefined) {
                this.bindings.set(triple.predicate, triple);
                return true;
            }

            const nestedBinding = new Bindings(currentLinkedShape, dependencies, linkedShape);
            if (nestedBinding.isFullyBounded()) {
                this.bindings.set(triple.predicate, triple);
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
        return false
    }


    public isFullyBounded() {
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
    public getNestedContainedStarPatternName(): string[] {
        return this.nestedContainedStarPatternName;
    }
}
