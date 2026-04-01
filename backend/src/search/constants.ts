export const PRODUCTS_INDEX_MAPPING = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        autocomplete: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'autocomplete_filter'],
        },
        autocomplete_search: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase'],
        },
      },
      filter: {
        autocomplete_filter: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 20,
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'standard',
        fields: {
          keyword: { type: 'keyword' },
          autocomplete: {
            type: 'text',
            analyzer: 'autocomplete',
            search_analyzer: 'autocomplete_search',
          },
        },
      },
      slug: { type: 'keyword' },
      description: {
        type: 'text',
        analyzer: 'standard',
      },
      price: { type: 'float' },
      category: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      subcategory: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      brand: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      image_url: { type: 'keyword' },
      isActive: { type: 'boolean' },
      createdAt: { type: 'date' },
    },
  },
};

export const PRODUCTS_INDEX_NAME = 'products';
