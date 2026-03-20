---
image: '/images/posts/sentry-error-monitoring/11.png'
title: '에러 모니터링 시스템 기술 조사 (Sentry)'
pubDate: 2022-06-10
author: 'chuz'
tags: ['개발']
---

> 해당 문서는 사내 에러 모니터링 시스템 도입을 위해 기술 조사를 했던 내용을 개발팀 내부에 공유 했던 문서입니다.
> 이전에 Sentry 를 사용했던 적이 있어, 주로 Sentry 와 관련된 내용을 담고 있습니다.
> 관련 정보를 찾는 분께 도움이 될까 싶어 공유 드립니다.

에러 모니터링 툴로 [Sentry](https://sentry.io/), [RollBar](https://rollbar.com/) 등 여러 툴이 있으나, Sentry가 가장 많이 사용 되고 있기도 하고, Android, IOS, Javascript 등 저희 기술 스택을 지원하고 있어 Sentry 위주로 내용 정리 하였습니다.

## Sentry

- Stackshare 기준 가장 많이 사용 되고 있어 사용법 및 사례를 찾아보기 쉬움. (구글링이 잘 됨)
[RIDI](https://ridicorp.com/story/monitoring-howto/), [LINE](https://engineering.linecorp.com/ko/blog/log-collection-system-sentry-on-premise/), [Dable](https://teamdable.github.io/techblog/Sentry-Error-Tracking)
- **Android**, **IOS**, **javascript Frontend**( React, Next, Vue, Nuxt, Angular…), **Backend** (Nest, Node, Java). 현재 우리 팀에서 사용하는 기술 스택은 전부 지원하고 있음. 각각 Document 존재.
- 따라서 팀 내에서 동일한 Tool을 사용하여 팀원간 이해도를 공유할 수 있음
- Github 의 [Sentry Repo](https://github.com/getsentry/sentry) 를 보면, 가장 최근 commit 시간이 2시간 전 일 정도로, 하루 5~10건씩 지속적으로 업데이트가 되고 있음. (Issue, PR 활발함)

---

### **Sentry 기능**

- 유사한 Error 들의 경우, 하나의 Issue 로 묶어 분류해 주기 때문에 동일한 이슈를 다양한 정보로 분석할 수 있음

![< 이슈 리스트 >  **첨부 이미지는 더블 클릭하여 확대 가능합니다.**](/images/posts/sentry-error-monitoring/11.png)

< 이슈 리스트 >  **첨부 이미지는 더블 클릭하여 확대 가능합니다.**

- 특정 이슈가 몇 번 발생 하였는지, 몇 명의 유저에게 발생 하였는지 분류하여 확인이 가능함.
- 각 이슈의 이벤트 및 유저 상세 정보를 확인 가능

![< 이슈 상세 페이지 - 1>](/images/posts/sentry-error-monitoring/1.png)

< 이슈 상세 페이지 - 1>

- 동일한 이슈로 묶여있는 4건의 이벤트 중 하나의 상세 페이지.
- 해당 이슈-이벤트의 발생 당시의 상세 정보 및 발생 빈도를 확인할 수 있음

![< 이슈 상세 페이지 - 2>](/images/posts/sentry-error-monitoring/3.png)

< 이슈 상세 페이지 - 2>

![Untitled](/images/posts/sentry-error-monitoring/4.png)

- 소스 코드의 어떤 부분에서 에러가 발생했는 지 추적이 가능함.
- 보통 [webpack](https://webpack.js.org/) 을 사용하는 경우 번들링(난독화) 된 코드가 배포되는데, `sourcemap` 을 생성하여 작업된 본래 코드로 확인 가능.
- 소스코드 번들러로 [vite](https://vitejs.dev/) 를 사용할 경우에도 [`vite-plugin-sentry`](https://www.npmjs.com/package/vite-plugin-sentry) 를 활용하여 소스맵을 생성할 수 있음

![< 이슈 상세 페이지 - 3 >](/images/posts/sentry-error-monitoring/5.png)

< 이슈 상세 페이지 - 3 >

![< 이슈 상세 페이지 - 4 >](/images/posts/sentry-error-monitoring/6.png)

< 이슈 상세 페이지 - 4 >

- Breadcrumbs (사이트 이동 경로) 를 통해 Client 가 어떤 페이지에서 오류를 발생 했는지 확인할 수 있음
- 위 예시는 `/` 경로에서 `div.page-layout`내부의 `button.bug-button` 을 click 하면서 발생한 
버그임을 추적해 주고 있음
- 또한 Client 의 브라우저, OS 등의 정보도 알 수 있음

![< 이슈 리스트 - 담당자 >](/images/posts/sentry-error-monitoring/12.png)

< 이슈 리스트 - 담당자 >

![< 릴리즈 관리 >](/images/posts/sentry-error-monitoring/7.png)

< 릴리즈 관리 >

- 이슈에 대해 릴리즈 버전별 및 담당자별 관리가 가능함
- 쉽게 생각해서 이슈가 스프린트 보드의 task와 같이 처리 된다고 보면 됨

![< Resolve , Ignore >](/images/posts/sentry-error-monitoring/8.png)

< Resolve , Ignore >

- 이러한 에러 모니터링 시스템을 팀에 도입하여 사용하다보면 어느 순간부턴가 잘 관리가 되지 않고 흐지부지하게 되는 경우가 많은데, 그 이유 중 하나가 ‘*발생은 하고 있으나*’ , ‘*원인을 파악하기 힘들고*’, ‘*유저 여정에 방해가 되지 않는*’ 이슈들이 쌓이고 쌓여서 마치 백로그에 기술 부채가 점점 쌓여가는 것처럼 이슈 부채가 점점 쌓여가서 인 경우가 있음
- 모든 이슈를 깔끔하게 처리할 수 있으면 좋겠으나, 실제 모니터링 시스템을 운영하다 보면 처리하기 어려운 unknown issue 가 발생하는 경우가 많으므로 이슈를 `ignore` 처리 할 수도 있음.
- `ignore` 는 시간 / 이슈 발생 빈도 / 이슈 경험 유저수 를 기준으로 설정할 수 있음
- 또한 해결 한 issue의 경우 `resolve` 처리를 하여 이번 릴리즈에 이슈를 해결 하였다고 체크할 수도 있음

![Untitled](/images/posts/sentry-error-monitoring/9.png)

![Untitled](/images/posts/sentry-error-monitoring/10.png)

![Untitled](/images/posts/sentry-error-monitoring/2.png)

- Slack을 통한 이슈 알림 및 Bitbucket, github 과 연동하여 버전 관리, commit 추적 등도 지원함 (팀 요금제 이상)
- [Sentry 가격 정책](https://sentry.io/pricing/) 에서 요금제별 제공 기능 확인할 수 있음. 팀 요금제의 경우 월 26달러 입니다.
- 프리티어로 우선 도입하기 위해선 공용 개발 계정으로 우선 사용해 볼 수 있을 듯 합니당

## 어떻게 사용 하였는가?

(아래 내용은 에러 모니터링 시스템을 이용하여 팀내에서 이슈를 컨트롤 했던 경험입니다…)

이전에 프로젝트 내부의 잠재적인 버그가 프로젝트가 점점 고도화 되면서 유저 경험이 중단될 정도의 큰 버그로 커졌던 일이 있었습니다.

- 메세지 도착 여부를 놓치지 않고 확인하고 싶다는 유저 문의가 많아, 채팅 메세지를 수신 하였을 때 알림음을 재생시켜주는 간단한 기능을 개발. 내부 테스트 및 배포.
- 내부 테스트에는 버그가 발견되지 않았으나, 알림음이 들리지 않는다는 고객 문의가 다수 들어옴 *(강사 고객의 경우 웹사이트를 켜놓고 수강생 문의가 들어왔을 때만 사이트를 확인하는 케이스가 많았음)*
- 개발단에서 확인 해보니 유저의 인터렉션이 없었던 경우, 사운드 재생을 막는 [브라우저 내부 정책](https://developer.chrome.com/blog/autoplay/)이 있었음
- 이 이슈는 프로그래밍적으로 해결이 불가하여, 유저들에게 사이트 접속 후, 사이트를 한번 조작할 것(클릭)을 권장하고 이슈가 종결 됨.

---

- 이렇게 이슈가 종결되고 3~4개월 뒤에 서비스가 중단되어 이용이 불가하다는 문의가 들어옴
- 서비스가 어떤 상황에서 중단되는 것인지 파악이 어려운 상황이었음
- 혹시나 싶어 Sentry 이슈 리스트들을 살펴 보았는데, 이전에 종결된 이슈였던 메세지 수신 알림음 쪽에서 이슈 리포트가 기록되고 있었음
- 확인 해보니, 브라우저 내부 정책으로 사운드 재생이 막히면서 로직이 중단되는 버그가 있었음 😱…

> 정확히 기억은 안 나지만, 아마 아래와 같은 코드상에 오류가 있었던 것으로 기억함.
> ( 메세지 수신 시 동작하는 onMessageHandler() 에 예외 처리가 되어 있지 않아, promise.all 에서 처리되던 function 에서 error를 던진다면 버그가 발생하게 됨 )
>
>
> ```jsx
> const getNewMessage = async () => (...);
> const playMessageSound = async () => (...);
> 
> // 메세지 수신 시, 호출 됨
> const onMessageHandler() => {
>   const r = await Promise.all([
>     getNewMessage(),
>     playMessageSound()
>   ])
> 	...
> }
> ```
> 

뒤늦게라도 이 이슈를 처리 하였으나, 이전에 이슈를 종결시킨 이후부터 얼마나 많은 유저들이 이 버그로 인해 서비스를 떠났을 지 걱정되는 순간이었습니다.

그리고 또한 Sentry와 같은 에러 모니터링 도구로 이슈 리포트를 기록하지 않았었다면, 원인을 모르던 상태에서 모든 코드들을 다 살펴볼 수도 없는 일이므로, 해결하는 데 시간이 훨씬 많이 들었을 버그라 생각 되었습니다.

위 예시 이외에도, 프로젝트 내에서 third-party 라이브러리나 SDK를 사용하는 경우 에러를 컨트롤 하는 데에 유용하게 쓰일 수 있었습니다. 
프로젝트에 *Sendbird SDK*, *channel Talk* 와 같은 외부 saas 를 사용할 때, 기종마다 초기화 시점이 다르다던지, 초기화 직후 sdk와 프로젝트간의 호환이 잘 안되는 경우가 있었는데 이러한 종류의 에러를 인식하고, 처리할 수 있었습니다.

가장 중요한 사용 목적은 팀 내에서 버그를 인식할 수 있다는 점인 것 같습니다. 
기존의 충성 고객의 경우 잘 사용하던 서비스 이용에 문제가 발생한다면 문의를 남겨, 팀 내에서도 문제 인식 → 버그 수정의 프로세스로 가게 되는 경우가 있겠으나, 앱을 처음 사용하거나 일반 유저들의 경우, 앱 사용중 에러로 인해 유저 경험이 중단된다면 문의 없이 앱을 삭제해 버릴 수도 있을 것 같습니다…😱
