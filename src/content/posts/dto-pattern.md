---
title: 'DTO 패턴을 사용하여 계층간 종속성 줄이기'
pubDate: 2022-07-25
author: '승환'
tags: ['개발']
---

안녕하세요! 서버 개발자 최승환 입니다!

저희 서버 프로젝트는 대규모 리팩토링 없이 5, 6년 이상 쭉 이어져 온 상태라 거의 야생의 세렝게티 대초원을 연상하게 만듭니다 🤣… (GitLens로 보면 5, 6 years ago… 가 찍힌다… 😮)

그래도 이러한 환경에서 더 나은 코드를 고민하기도 하고, 또 이것저것 도입해보려 시도도 해보면서, 배우게 되는 점도 있는 것 같습니다. 그리고 레거시를 분석하는 그 나름의 재미(?)도 있습니다. 😄

현재 저는 저희 유저들에게 쿠폰 기능 제공하기 위해 쿠폰 시스템을 개발하고 있는데요, 이 작업 과정에서 생겼던 고민과 어떻게 풀어 갔는지에 관한 경험을 공유하기 위해 글을 작성하게 되었습니다.

---

우선, 더 나은 구조를 고민하게 되었던 계기는 다음과 같습니다.

아래는 `Client` 단에 제공하기 위한 API 가이드 문서 중 일부입니다.`Coupon` 타입을 정의하고 있습니다.

```tsx
/** Coupon Type */
type Coupon = {
	code: String
	provider: CouponProvider 
	type:  CouponType 
	status: CouponStatus 
	userId?: String
	registeredDate?: Date
	extinctionDate?: Date
	activatedDate:?: Date
	startDate?: Date 
	endDate?: Date
	expiryDate: Date
	createdAt: Date 
	...
}
```

`Coupon` 은 ‘ 쿠폰 생성 → 유저 발행 → 등록/만료 → 사용/만료 → 사용 완료 ‘ 의 흐름으로 상태가 변하기 때문에 진행 상태에 따라 각각의 관련된 `Date` 값이 DB 상에 시점에 따라 기록 되었을 수도, 기록 되지 않았을 수도 있습니다.

`Server`에서 데이터 가공 없이 `Client` 에 `Coupon` `Entity` 를 직접 전달하게 된다면 `Client`는 시점에 따라 서로 다른 데이터를 처리하기 위한 추가 방어 코드가 필요해 집니다.

아래는 `CouponController`  코드입니다.

`CouponService` 의 `registerCoupon()` ,`useCoupon()` 을 이용하여 서비스단에서 비즈니스 로직을 처리하고 그에 따른 각각의 `registeredCoupon`, `usedCoupon` 결과 값을 받고 있습니다.

그 후, `CouponService` 단에서 처리되던 `mongoDB document` 데이터인 `_id, updateAt, user, email…` 등등의 데이터를 제거하고`Client`단에 전달될  `couponInfo` 데이터만 정제하고 있습니다.

```jsx
// CouponController

/**
 * @description 쿠폰 등록
 */
router.post('/register', requireMe, async (req, res, next) => {
  try {
		...
    const registeredCoupon = await CouponService.registerCoupon({ userObjectId, code });
		
		// couponInfo 정제
    const { updatedAt, user, email, _id, ...couponInfo } = registeredCoupon.toObject();
    couponInfo.status = CouponService.getCouponStatus(registeredCoupon);

    res.status(200).send({ coupon: couponInfo });
		...
	}
});

/**
 * @description 쿠폰 사용
 */
router.post('/use', requireMe, async (req, res, next) => {
  try {
    ...
    const coupon = await CouponService.getCoupon({ code });

    ...

    const { usedCoupon, isSubscribeExtended } = await CouponService.useCoupon({ coupon, userObjectId });
		
		// couponInfo 정제
    const { updatedAt, user, email, _id, ...couponInfo } = usedCoupon.toObject();
    couponInfo.status = CouponService.getCouponStatus(couponInfo);

    res.status(200).send({ coupon: couponInfo, isSubscribeExtended });
		...
  }
});
```

위 코드는 구조적인 측면에서 몇가지 문제점이 있습니다.

- `CouponController` 는 `CouponService` 단에서`Coupon` 데이터와 관련하여 `updateAt`, `user`, `email` 등등의 값들을 처리하고 있을 것이란 사실을 알고 있어야 합니다. 즉, `Controller` 와 `Service`간의 높은 결합도가 있습니다.
- 단순히 값을 Except 하는 방식의 데이터 정제 방식으로는 `Coupon`의 `Date` 값들은 시점에 따라 기록 되었거나, 기록되지 않았기 때문에 `Client`는 `Coupon` 데이터를 일관되지 않게 받게 됩니다. 이 또한 `Server` 와 `Client` 간의 결합도가 높아졌다 할 수 있겠습니다.
- 그 외에도, 코드가 더럽습니다…

## DTO 패턴을 도입하자

![Untitled](/images/posts/dto-pattern/1.png)

[DTO(Data Transfer Object)](https://en.wikipedia.org/wiki/Data_transfer_object) 는 계층 간 데이터를 전송할 때 사용 되는 객체입니다.

`DTO`는 프로세스가 원격 인터페이스와*(API)* 통신 할 때, `Server`와 `Client` 사이의 요청-응답 과정에서의 네트워크 비용이 많이 발생하는 것을 고려하여 이 오버헤드를 줄이기 위해 만들어진 디자인 패턴입니다.

이러한 상황을 생각해 볼 수 있을 것 같습니다. 특정 도메인에 관한 서버의 응답에서, `Server`는 클라이언트의 call-parameter에 따라 부분적인 데이터 응답을 보내주게 되면 결과적으로 `Client`는 로직 상 다른 데이터가 필요해 질 경우 서로 다른 parameter로 여러번의 요청을 `Server`쪽에 보내야 하게 됩니다. 이 과정에서 요청-응답의 왕복 네트워크 비용이 발생하게 됩니다.

또한 위의 그림과 같이 `User`, `Role` 이 각기 서로 다른 도메인의 데이터를 `Client`가 필요로 하는 경우, `Client` 는 각각 `User` 도메인과 `Role` 도메인에 관련된 요청을 몇차례 보내게 될 것입니다.

따라서 이에 대한 해결 방안으로, `Server`쪽에서 `UserDTO` 와 같은 `DTO`를 만들어 `Client` 가 필요로하는 데이터 묶음을 제공하는 것입니다. 이렇게 되면 이전과 같이 `Client`가 추가적인 데이터를 필요로 하게 됐을 때 보내게 되는 요청을 줄일 수 있게 되어 `Server`와 `Client` 간의 네트워크 비용이 절감 됩니다.

또한 위의 예시 이외에도, 계층 간의 통신에 `DTO` 를 사용하게 된다면 서로 간의 의존성을 줄일 수 있게 됩니다. 

`CouponController` 는 `CouponService` 에서 반환된 결과를 정제하는 로직을 매 `Service` 요청 마다 갖고 있습니다. 이 동작은 `Controller`의 여러 곳에 존재하고 있어 추후 유지보수 비용이 많이 발생하게 됩니다.

따라서 간단한 `CouponDTO`와 `Mapper` Util을 구현하였습니다.

```tsx
/** Mapper */
const mapper = ({ dto = {}, data = null } = {}) => {
  try {

		// 정의된 dto 객체에서 key로 배열을 생성
    const dtoKeys = Object.keys(dto);
    const result = {};
	
		// dtoKeys 배열을 순회하며 data 에서 값을 가져옴
    dtoKeys.forEach((key) => {
      result[key] = data[key] || dto[key];
    });

    return result;
  } catch (e) {
		...
  }
};

const couponDtoMapper = ({ coupon = {}, getStatusHandler = null } = {}) => {
  try {
    const mappedCouponDto = mapper({ dto: couponDto, data: coupon });

    mappedCouponDto.status = getStatusHandler ? getStatusHandler(coupon) : couponDto.status;

    return mappedCouponDto;
  } catch (e) {
    ...
  }
};

/** DTO (Data Transfer Object) */
const couponDto = {
  code: '',
  provider: '',
  type: '',
  userId: '',
  registeredDate: null,
  extinctionDate: null,
  activatedDate: null,
  startDate: null,
  endDate: null,
  expiryDate: null,
  createdAt: null,
  groupId: '',
  status: '',
};

```

`Mapper` 를 공용적으로 사용하기 위해 `CouponDtoMapper`와 `mapper`로 분리 하였습니다.

`mapper` 는 `dto` 와 `data` 를 전달 받습니다. 전달받은 `dto` 에서 `Object.keys` 를 이용하여 `dto` 의 `key`로 이루어진 배열을 생성합니다. 그 후, loop를 돌며 `data` 에서 `dto` 키에 해당하는 값을 가져옵니다.

`couponDtoMapper` 는 공용 모듈인 `mapper` 를 이용하여 `couponDto`에 정의된 값들을 일괄적으로 가져온 후, 인자로 전달된 `getStatusHandler` 를 이용하여 `coupon.status` 값을 가져오고 있습니다.

아래는 `DTO`와 `Mapper`를 이용하여 수정한 `CouponContoller` 입니다. 

```tsx
router.post('/register', requireMe, async (req, res, next) => {
  try {
		...

    const registeredCoupon = await CouponService.registerCoupon({ userObjectId, code });

    const couponInfo = couponDtoMapper({
      coupon: registeredCoupon.toObject(),
      getStatusHandler: CouponService.getCouponStatus,
    });

    res.status(200).send({ coupon: couponInfo });
		...
  } 
});
```

`CouponService` 에서 처리된 결과를 `couponDtoMapper` 를 이용해 `DTO`로 만든 뒤, Client에 전달하고 있습니다.

`Controller` 에서 `Service` 종속적으로 나타나던 데이터 정제 코드가 제거 되었습니다. 또한 앞으로 `Client` 는 일관된 데이터를 받을 것을 예상하고 작업할 수 있게 되었습니다. 

---

아직 위의 작업 결과는 완벽하지 않습니다. CouponController 는 여전히 `Coupon` `Entity` 를 `CouponService`에서 직접 전달받아 `coupon.toObject()` 로 변환하는 등의 종속성이 남아 있습니다. 또한 `CouponController` → `CouponService` 를 호출하는 과정의 종속성이 남아 있습니다. 그리고 결과로 `Coupon` 만을 받을 때 뿐만 아니라, 다양한 케이스에서의 `dto`가 필요합니다. 그 외에도 여러 코드 결함들이 있을 수 있겠습니다… 😅

Nest나 Spring과 같은 프레임워크를 사용할 때와는 다르게 Express는 자유도가 굉장히 높아 작업 과정에서 ‘문제 직면/인식' → ‘방법 도출' 의 과정을 경험하게 되는 것 같습니다.

써 놓고 보니 글이 길어졌군요… 그럼 이만 마치겠습니다!
