import { createSimplePropertyObjectFromQuery } from '../lib/query';
import type { Term, BaseQuad } from '@rdfjs/types';
import { DataFactory } from 'rdf-data-factory';

const DF = new DataFactory<BaseQuad>();

describe('query', () => {
  describe('createSimplePropertyObjectFromQuery', () => {
    it('should return the property with an IRI given a query with one triple', () => {
      const query = 'SELECT * WHERE { ?x <http://exemple.ca> ?z }';
      const resp = createSimplePropertyObjectFromQuery(query);
      expect(resp.length).toBe(1);
      expect(resp[0].property_iri).toBe('http://exemple.ca');
      expect(resp[0].object.termType).toBe('Variable');
      expect(resp[0].object.value).toBe('z');
    });

    it('should return no property given a query with one triple', () => {
      const query = 'SELECT * WHERE { ?x ?o ?z }';
      const resp = createSimplePropertyObjectFromQuery(query);
      expect(resp.length).toBe(0);
    });

    it('should the properties with a query with multiple triples', () => {
      const query = `SELECT * WHERE { 
                ?x ?o ?z .
                ?x <http://exemple.ca> ?z .
                ?z <http://exemple.be> "abc" .
                ?w <http://exemple.be> <http://objet.fr> .
                <http://sujet.cm> <http://predicat.cm> "def" .
                <http://sujet.cm> ?m "def" .
            }`;
      const resp = createSimplePropertyObjectFromQuery(query);
      expect(resp.length).toBe(4);

      expect(resp[0].property_iri).toBe('http://exemple.ca');
      expect(resp[0].object.termType).toBe('Variable');
      expect(resp[0].object.value).toBe('z');

      expect(resp[1].property_iri).toBe('http://exemple.be');
      expect(resp[1].object.termType).toBe('Literal');
      expect(resp[1].object.value).toBe('abc');

      expect(resp[2].property_iri).toBe('http://exemple.be');
      expect(resp[2].object.termType).toBe('NamedNode');
      expect(resp[2].object.value).toBe('http://objet.fr');

      expect(resp[3].property_iri).toBe('http://predicat.cm');
      expect(resp[3].object.termType).toBe('Literal');
      expect(resp[3].object.value).toBe('def');
    });

    it('should the properties with a complex query', () => {
      const query = `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      PREFIX snvoc: <http://solidbench-server:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/>
      SELECT ?commentId ?commentContent ?commentCreationDate ?replyAuthorId ?replyAuthorFirstName ?replyAuthorLastName ?replyAuthorKnowsOriginalMessageAuthor WHERE {
        <http://solidbench-server:3000/pods/00000002199023256081/comments/Philippines#274878069404> snvoc:id ?messageId;
          snvoc:hasCreator ?messageCreator.
        ?messageCreator snvoc:id ?messageCreatorId.
        ?comment snvoc:replyOf <http://solidbench-server:3000/pods/00000002199023256081/comments/Philippines#274878069404>;
          rdf:type snvoc:Comment;
          snvoc:id ?commentId;
          snvoc:content ?commentContent;
          snvoc:creationDate ?commentCreationDate;
          snvoc:hasCreator ?replyAuthor.
        ?replyAuthor snvoc:id ?replyAuthorId;
          snvoc:firstName ?replyAuthorFirstName;
          snvoc:lastName ?replyAuthorLastName.
        OPTIONAL {
          ?messageCreator ((snvoc:knows/snvoc:hasPerson)|^(snvoc:knows/snvoc:hasPerson)) ?replyAuthor.
          BIND("true"^^xsd:boolean AS ?replyAuthorKnowsOriginalMessageAuthorInner)
        }
        BIND(COALESCE(?replyAuthorKnowsOriginalMessageAuthorInner, "false"^^xsd:boolean) AS ?replyAuthorKnowsOriginalMessageAuthor)
      }`;
      const snvocPrefix = 'http://solidbench-server:3000/www.ldbc.eu/ldbc_socialnet/1.0/vocabulary/';
      const rdfPrefix = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

      const resp = createSimplePropertyObjectFromQuery(query);
      const comment_philippines = 'http://solidbench-server:3000/pods/00000002199023256081/comments/Philippines#274878069404';
      const expectedProperties = [
        { property_iri: `${snvocPrefix}id`, object: DF.variable('messageId') },
        { property_iri: `${snvocPrefix}hasCreator`, object: DF.variable('messageCreator') },
        { property_iri: `${snvocPrefix}id`, object: DF.variable('messageCreatorId') },
        { property_iri: `${snvocPrefix}replyOf`, object: DF.namedNode(comment_philippines) },
        { property_iri: `${rdfPrefix}type`, object: DF.namedNode(`${snvocPrefix}Comment`) },
        { property_iri: `${snvocPrefix}id`, object: DF.variable('commentId') },
        { property_iri: `${snvocPrefix}content`, object: DF.variable('commentContent') },
        { property_iri: `${snvocPrefix}creationDate`, object: DF.variable('commentCreationDate') },
        { property_iri: `${snvocPrefix}hasCreator`, object: DF.variable('commentCreationDate') },
        { property_iri: `${snvocPrefix}id`, object: DF.variable('replyAuthorId') },
        { property_iri: `${snvocPrefix}firstName`, object: DF.variable('replyAuthorFirstName') },
        { property_iri: `${snvocPrefix}lastName`, object: DF.variable('replyAuthorLastName') },
        { property_iri: `${snvocPrefix}knows`, object: DF.blankNode() },
        { property_iri: `${snvocPrefix}hasPerson`, object: DF.blankNode() },
        { property_iri: `${snvocPrefix}knows`, object: DF.blankNode() },
        { property_iri: `${snvocPrefix}hasPerson`, object: DF.blankNode() },

      ].sort();

      expect(resp.length).toBe(expectedProperties.length);
      for (let i=0;i<resp.length;i++) {
        expect(resp[i].property_iri).toStrictEqual(expectedProperties[i].property_iri);
        expect(resp[i].object.termType).toStrictEqual(expectedProperties[i].object.termType);
      }

    });

    it('should return an error given a malformed query', () => {
      const query = 'what a valid query';
      expect(() => { createSimplePropertyObjectFromQuery(query); }).toThrow();
    });
  });
});
