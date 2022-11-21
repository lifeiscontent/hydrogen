import {type LoaderArgs, json} from '@shopify/hydrogen-remix';
import {type FetcherWithComponents, useFetcher} from '@remix-run/react';
import {flattenConnection} from '@shopify/hydrogen-react';
import {
  Product,
  ProductConnection,
  ProductSortKeys,
} from '@shopify/hydrogen-react/storefront-api-types';
import {useEffect} from 'react';
import invariant from 'tiny-invariant';
import {getLocalizationFromLang} from '~/lib/utils';

interface GetProductsProps {
  products: Product[] | [];
  state: FetcherWithComponents<any>['state'];
  count: number | null;
}

interface ProductsCompProps {
  children: (props: GetProductsProps) => JSX.Element;
  count: number | null;
  /* query by `available_for_sale`, `created_at`, `product_type`, `tag`, `tag_not`, `title`, `updated_at`, `variants.price`, `vendor`. @see: https://shopify.dev/api/usage/search-syntax#examples*/
  query?: string;
  reverse?: boolean;
  sortKey?: ProductSortKeys;
}

// adjust if changing the routes pathname
const LOADER_PATH = '/api/products';

/**
 * Fetch a given set of products from the storefront API
 * @see: https://shopify.dev/api/storefront/2023-01/queries/products
 * @param count
 * @param query
 * @param reverse
 * @param sortKey
 * @returns Product[]
 */
async function loader({request, params, context: {storefront}}: LoaderArgs) {
  const {language, country} = getLocalizationFromLang(params.lang);
  const url = new URL(request.url);

  const searchParams = new URLSearchParams(url.searchParams);
  const sortKey = searchParams.get('sortKey') ?? 'BEST_SELLING';
  const query = searchParams.get('query') ?? '';

  let reverse;
  try {
    const _reverse = searchParams.get('reverse');
    if (_reverse === 'true') {
      reverse = true;
    }
  } catch (_) {
    reverse = false;
  }
  let count;
  try {
    const _count = searchParams.get('count');
    if (typeof _count === 'string') {
      count = parseInt(_count);
    }
  } catch (_) {
    count = 4;
  }

  const {products} = await storefront.query<{
    products: ProductConnection;
  }>(PRODUCTS_QUERY, {
    variables: {
      country,
      count,
      language,
      query,
      reverse,
      sortKey,
    },
    cache: storefront.CacheLong(),
  });

  invariant(products, 'No data returned from top products query');

  return json({
    products: flattenConnection(products),
  });
}

const PRODUCTS_QUERY = `#graphql
  fragment ProductCard on Product {
    id
    title
    publishedAt
    handle
    variants(first: 1) {
      nodes {
        id
        image {
          url
          altText
          width
          height
        }
        price: priceV2 {
          amount
          currencyCode
        }
        compareAtPrice: compareAtPriceV2 {
          amount
          currencyCode
        }
        product {
          title
          handle
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
  query (
    $query: String
    $count: Int
    $reverse: Boolean
    $country: CountryCode
    $language: LanguageCode
    $sortKey: ProductSortKeys
  ) @inContext(country: $country, language: $language) {
    products(first: $count, sortKey: $sortKey, reverse: $reverse, query: $query) {
      nodes {
        ...ProductCard
      }
    }
  }
`;

// @todo: optional could remove
function Products({
  children,
  count = 4,
  query = '',
  reverse = false,
  sortKey = 'BEST_SELLING',
}: ProductsCompProps) {
  const {products, state} = useProducts({
    sortKey,
    count,
    query,
    reverse,
  });

  return children({products, count, state});
}

// @todo: optional could remove
function useProducts(props: Omit<ProductsCompProps, 'children'>) {
  const queryString = Object.entries(props)
    .map(([key, val]) => `${key}=${val}`)
    .join('&');

  const {load, data, state} = useFetcher();

  useEffect(() => {
    load(`${LOADER_PATH}?${encodeURIComponent(queryString)}`);
  }, [load, queryString]);

  const products = (data?.products ?? []) as Product[];

  return {products, state};
}

// no-op
export default function ProductsApiRoute() {
  return null;
}

export {loader, Products, useProducts};
