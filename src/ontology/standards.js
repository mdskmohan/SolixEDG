// Industry vocabularies an ontology can be aligned to. A working subset of each —
// enough to propose owl:equivalentClass links with evidence. Seed data.

export const STANDARDS = {
  schema: {
    label: "schema.org", base: "https://schema.org/",
    classes: [
      { id: "Person", label: "Person", syn: ["individual", "people"], def: "A person (alive, dead, undead, or fictional)." },
      { id: "Organization", label: "Organization", syn: ["company", "business", "party", "legal entity"], def: "An organization such as a school, NGO, corporation, club." },
      { id: "Customer", label: "Customer", syn: ["client", "buyer", "account"], def: "A party that buys goods or services (schema.org uses Person/Organization as customer)." },
      { id: "Order", label: "Order", syn: ["purchase", "sales order"], def: "An order is a confirmation of a transaction (a receipt)." },
      { id: "OrderItem", label: "Order Item", syn: ["order line", "line item"], def: "An order item is a line of an order." },
      { id: "Product", label: "Product", syn: ["item", "sku", "article", "good"], def: "Any offered product or service." },
      { id: "Offer", label: "Offer", syn: ["promotion", "deal", "markdown"], def: "An offer to transfer some rights to an item or to provide a service." },
      { id: "Store", label: "Store", syn: ["shop", "outlet", "location"], def: "A retail good store." },
      { id: "ParcelDelivery", label: "Parcel Delivery", syn: ["shipment", "parcel", "consignment"], def: "The delivery of a parcel." },
      { id: "Invoice", label: "Invoice", syn: ["bill"], def: "A statement of the money due for goods or services." },
      { id: "PaymentMethod", label: "Payment Method", syn: ["payment"], def: "A payment method is a standardized procedure for transferring the monetary amount." },
      { id: "Place", label: "Place", syn: ["address", "location", "site"], def: "Entities that have a somewhat fixed, physical extension." },
      { id: "Event", label: "Event", syn: ["occurrence"], def: "An event happening at a certain time and location." },
      { id: "CategoryCode", label: "Category Code", syn: ["category", "product category", "class"], def: "A Category Code." },
      { id: "MonetaryAmount", label: "Monetary Amount", syn: ["amount", "price", "value"], def: "A monetary value or range." },
    ],
  },
  fibo: {
    label: "FIBO", base: "https://spec.edmcouncil.org/fibo/ontology/",
    classes: [
      { id: "FND/Parties/Parties/Party", label: "Party", syn: ["party", "counterparty", "legal entity"], def: "A person or organization that plays some role." },
      { id: "BE/LegalEntities/LegalPersons/LegalEntity", label: "Legal Entity", syn: ["company", "organization", "supplier", "vendor"], def: "A legal person that is not a natural person." },
      { id: "FND/AgentsAndPeople/People/Person", label: "Person", syn: ["individual", "natural person"], def: "A human being." },
      { id: "FBC/ProductsAndServices/ClientsAndAccounts/Customer", label: "Customer", syn: ["client", "account holder", "buyer"], def: "A party that receives products or services." },
      { id: "FBC/ProductsAndServices/ClientsAndAccounts/Account", label: "Account", syn: ["ledger account"], def: "A container for records of transactions." },
      { id: "FND/TransactionsExt/Transactions/Transaction", label: "Transaction", syn: ["posting", "ledger entry", "txn"], def: "An exchange of value between parties." },
      { id: "FND/ProductsAndServices/ProductsAndServices/Product", label: "Product", syn: ["item", "good", "sku"], def: "Something produced and offered." },
      { id: "FND/Accounting/CurrencyAmount/MonetaryAmount", label: "Monetary Amount", syn: ["amount", "value"], def: "An amount of money in a currency." },
      { id: "FND/Accounting/CurrencyAmount/Currency", label: "Currency", syn: ["ccy"], def: "A medium of exchange." },
      { id: "FND/Agreements/Contracts/Contract", label: "Contract", syn: ["agreement", "subscription"], def: "A binding agreement between parties." },
      { id: "FBC/ProductsAndServices/FinancialProductsAndServices/Supplier", label: "Supplier", syn: ["vendor", "provider"], def: "A party that supplies goods or services." },
    ],
  },
};

// Sample exports, one per import source, so the import flow can be shown end to end.
export const IMPORT_SAMPLES = {
  turtle: `@prefix ret: <https://data.example.com/ontology/retail#> .

ret:Party a owl:Class ; rdfs:label "Party" ;
  rdfs:comment "A person or organisation the business deals with." .
ret:Customer a owl:Class ; rdfs:label "Customer" ; rdfs:subClassOf ret:Party ;
  rdfs:comment "A party that buys from the group." ; skos:altLabel "Client", "Buyer" .
ret:Order a owl:Class ; rdfs:label "Order" ;
  rdfs:comment "A commitment by a customer to buy." .
ret:Subscription a owl:Class ; rdfs:label "Subscription" ;
  rdfs:comment "A recurring agreement to deliver a product." .
ret:placedBy a owl:ObjectProperty, owl:FunctionalProperty ; rdfs:label "placed by" ;
  rdfs:domain ret:Order ; rdfs:range ret:Customer ; owl:inverseOf ret:places .
ret:heldBy a owl:ObjectProperty ; rdfs:label "held by" ;
  rdfs:domain ret:Subscription ; rdfs:range ret:Customer .
ret:email a owl:DatatypeProperty ; rdfs:label "email" ; rdfs:domain ret:Customer ; rdfs:range xsd:string .
`,
  shacl: `@prefix ret: <https://data.example.com/ontology/retail#> .

ret:CustomerShape a sh:NodeShape ;
  sh:targetClass ret:Customer ;
  sh:property [ sh:path ret:email ; sh:minCount 1 ; sh:maxCount 1 ; sh:pattern "^[^@]+@[^@]+$" ] ;
  sh:property [ sh:path ret:segment ; sh:in ( "Consumer" "SMB" "Enterprise" ) ; sh:severity sh:Warning ] .
`,
  skos: `@prefix fin: <https://data.example.com/vocab/finance#> .

fin:Revenue a skos:Concept ; skos:prefLabel "Revenue" ; skos:altLabel "Turnover", "Sales" ;
  skos:definition "Income from the sale of goods and services." .
fin:RecurringRevenue a skos:Concept ; skos:prefLabel "Recurring Revenue" ; skos:broader fin:Revenue ;
  skos:definition "Revenue that is contractually expected to repeat." .
`,
  palantir: `{
  "name": "Supply Chain",
  "objectTypes": [
    { "apiName": "Supplier", "displayName": "Supplier", "primaryKey": "supplierId",
      "properties": { "supplierId": { "dataType": "string" }, "country": { "dataType": "string" }, "rating": { "dataType": "double" } } },
    { "apiName": "PurchaseOrder", "displayName": "Purchase Order", "primaryKey": "poNumber",
      "properties": { "poNumber": { "dataType": "string" }, "amount": { "dataType": "decimal" }, "orderedAt": { "dataType": "timestamp" } } }
  ],
  "linkTypes": [
    { "apiName": "issuedTo", "inverseApiName": "receives", "objectTypeA": "PurchaseOrder", "objectTypeB": "Supplier", "cardinality": { "a": "MANY", "b": "ONE" } }
  ]
}`,
};

export const IMPORT_SOURCES = [
  { v: "turtle", l: "OWL / RDFS (Turtle)", fmt: "turtle" },
  { v: "shacl", l: "SHACL shapes (Turtle)", fmt: "turtle" },
  { v: "skos", l: "SKOS vocabulary (Turtle)", fmt: "turtle" },
  { v: "palantir", l: "Palantir Foundry ontology (JSON)", fmt: "palantir" },
  { v: "topbraid", l: "TopBraid EDG · connection", fmt: "turtle", conn: true, sample: "turtle" },
  { v: "poolparty", l: "PoolParty · connection", fmt: "turtle", conn: true, sample: "skos" },
  { v: "protege", l: "Protégé project (Turtle)", fmt: "turtle", sample: "turtle" },
];
