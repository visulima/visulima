import { Callout } from '@visulima/nextra-theme-docs'

# Next.js와 함께 사용하는 방법

## 클라이언트 사이드 데이터 가져오기

페이지가 빈번하게 업데이트하는 데이터를 포함하고 이를 프리렌더링할 필요가 없다면, SWR은 완벽하게 적합하며 어떠한 특별한 설정도 필요하지 않습니다. `useSWR`을 임포트하고 데이터를 사용하는 컴포넌트 내에서 이 hook을 사용하기만 하면 됩니다.

동작 방식:

-   먼저, 데이터 없이 페이지를 즉시 보여줍니다. 빠진 데이터를 위한 로딩 상태를 보여주어도 됩니다.
-   그다음, 클라이언트 사이드에서 데이터를 가져와 준비되면 보여줍니다.

이런 접근은 사용자 대시보드 페이지 같은 곳에 적합합니다. 대시보드는 비공개용이며 사용자별 페이지이므로 SEO와 관계가 없고 페이지를 프리렌더링할 필요도 없습니다. 데이터는 빈번하게 업데이트되므로 요청 시에 데이터를 가져와야 합니다.

## 기본값으로 프리렌더링하기

페이지가 반드시 프리렌더링 되어야 한다면, Next.js는 [2가지 형태의 프리렌더링](https://nextjs.org/docs/basic-features/data-fetching)을 지원합니다:
**정적 생성 (SSG)** 및 **서버 사이드 렌더링 (SSR)**.

SWR와 함께 SEO를 위해 페이지를 프리렌더링 할 수 있고, 캐싱, 재검증, 포커스 추적, 클라이언트 사이드에서 간격을 두고 다시 가져오기와 같은 기능도 있습니다.

모든 SWR hooks에 초기값으로 프리패칭된 데이터를 넘겨주기 위해 [`SWRConfig`](/docs/global-configuration)의 `fallback` 옵션을 사용할 수 있습니다.
`getStaticProps`를 사용한 예시:

```jsx
export async function getStaticProps() {
    // `getStaticProps`는 서버 사이드에서 실행됩니다.
    const article = await getArticleFromAPI();
    return {
        props: {
            fallback: {
                "/api/article": article,
            },
        },
    };
}

function Article() {
    // `data`는 `fallback`에 있기 때문에 항상 사용할 수 있습니다.
    const { data } = useSWR("/api/article", fetcher);
    return <h1>{data.title}</h1>;
}

export default function Page({ fallback }) {
    // `SWRConfig` 경계 내부에 있는 SWR hooks는 해당 값들을 사용합니다.
    return (
        <SWRConfig value={{ fallback }}>
            <Article />
        </SWRConfig>
    );
}
```

해당 페이지는 여전히 프리렌더링 됩니다. SEO 친화적이고, 응답이 빠르지만, 클라이언트 사이드의 SWR에 의해 완전히 구동됩니다. 데이터는 동적이고 시간이 지나면서 자체 업데이트될 수 있습니다.

<Callout emoji="💡">
  `Article` 컴포넌트는 미리 생성된 데이터로 먼저 렌더링하고, 해당 페이지가 하이드레이트 된 후에 최신 데이터를 다시 가져와 새로 고칩니다.
</Callout>
