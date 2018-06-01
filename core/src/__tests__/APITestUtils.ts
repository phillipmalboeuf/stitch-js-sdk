import { sign } from "jsonwebtoken";
import {
  anyOfClass,
  instance,
  match,
  mock,
  objectContaining,
  when
} from "ts-mockito";
import { Matcher } from "ts-mockito/lib/matcher/type/Matcher";
import { StitchRequestClient } from "../lib";
import APIAuthInfo from "../lib/auth/internal/models/APIAuthInfo";
import APICoreUserProfile from "../lib/auth/internal/models/APICoreUserProfile";
import APIStitchUserIdentity from "../lib/auth/internal/models/APIStitchUserIdentity";
import { BasicRequest } from "../lib/internal/net/BasicRequest";
import Method from "../lib/internal/net/Method";
import { StitchRequest } from "../lib/internal/net/StitchRequest";

expect.extend({
  toEqualRequest(received: StitchRequest, argument: StitchRequest) {
    const passed =
      received.method === argument.method &&
      received.body === argument.body &&
      JSON.stringify(received.headers) === JSON.stringify(argument.headers) &&
      received.path === argument.path;

    if (passed) {
      return {
        message: () =>
          this.utils.matcherHint(".not.toBe") +
          "\n\n" +
          `Expected value to be (using Object.is):\n` +
          `  ${this.utils.printExpected(argument)}\n` +
          `Received:\n` +
          `  ${this.utils.printReceived(received)}`,
        pass: true
      };
    } else {
      return {
        message: () =>
          this.utils.matcherHint(".not.toBe") +
          "\n\n" +
          `Expected value to not be (using Object.is):\n` +
          `  ${this.utils.printExpected(argument)}\n` +
          `Received:\n` +
          `  ${this.utils.printReceived(received)}`,
        pass: false
      };
    }
  }
});

declare global {
  namespace jest {
    // tslint:disable-next-line:interface-name
    interface Matchers<R> {
      toEqualRequest(argument: StitchRequest): R;
    }
  }
}

/**
 * Gets an access token JWT for testing that is always the same.
 */
export const TEST_ACCESS_TOKEN: string = (() => {
  const claims = {
    typ: "access"
  };

  return sign(
    {
      claims,
      exp: new Date().getMilliseconds() + 1000 * 1000,
      iat: new Date().getMilliseconds() - 1000 * 1000,
      sub: "uniqueUserID"
    },
    "abcdefghijklmnopqrstuvwxyz1234567890"
  );
})();

/**
 * Gets an refresh token JWT for testing that is always the same.
 */
export const TEST_REFRESH_TOKEN: string = (() => {
  const claims = {
    typ: "refresh"
  };

  return sign(
    {
      claims,
      iat: new Date().getMilliseconds() - 1000 * 1000,
      sub: "uniqueUserID"
    },
    "abcdefghijklmnopqrstuvwxyz1234567890"
  );
})();

/**
 * Gets a login response for testing that is always the same.
 */
export const TEST_LOGIN_RESPONSE: APIAuthInfo = (() => {
  return new class extends APIAuthInfo {
    constructor() {
      super(
        "some-unique-user-id",
        "0123456012345601234560123456",
        TEST_ACCESS_TOKEN,
        TEST_REFRESH_TOKEN
      );
    }
  }();
})();

/**
 * Gets a link response for testing that is always the same.
 */
export const TEST_LINK_RESPONE: APIAuthInfo = (() => {
  return new class extends APIAuthInfo {
    constructor() {
      super(
        "some-unique-user-id",
        "0123456012345601234560123456",
        TEST_ACCESS_TOKEN,
        TEST_REFRESH_TOKEN
      );
    }
  }();
})();

/**
 * Gets a user profile for testing that is always the same.
 */
export const TEST_USER_PROFILE: APICoreUserProfile = (() => {
  const identities = [
    new class extends APIStitchUserIdentity {
      constructor() {
        super("bar", "baz");
      }
    }()
  ];

  return new class extends APICoreUserProfile {
    constructor() {
      super("normal", {}, identities);
    }
  }();
})();

export class RequestClassMatcher extends Matcher {
  constructor(
    private readonly pathRegEx?: RegExp,
    private readonly method?: Method
  ) {
    super();
  }

  public match(value: any): boolean {
    if (value instanceof StitchRequest) {
      if (this.pathRegEx && !this.pathRegEx.test(value.path)) {
        return false;
      }

      if (this.method && this.method !== value.method) {
        return false;
      }

      return true;
    }

    return false;
  }

  public toString(): string {
    return `Did not match ${this.pathRegEx} or method ${this.method}`;
  }
}

/**
 * Gets a mocked request client for testing that can be extended. In general
 * it supports enough to return responses for login, profile, and link. Anything else
 * will return null {@link Response}s.
 */
export function getMockedRequestClient(): StitchRequestClient {
  const requestClientMock = mock(StitchRequestClient);

  // Any /login works
  when(
    requestClientMock.doRequest(new RequestClassMatcher(
      new RegExp(".*/login")
    ) as any)
  ).thenResolve({
    body: JSON.stringify(TEST_LOGIN_RESPONSE),
    headers: {},
    statusCode: 200
  });

  // Any /login works
  when(
    requestClientMock.doRequest(new RequestClassMatcher(
      new RegExp(".*/session")
    ) as any)
  ).thenResolve({
    body: JSON.stringify(TEST_LOGIN_RESPONSE),
    headers: {},
    statusCode: 200
  });

  // Profile works if the access token is the same as the above
  when(
    requestClientMock.doRequest(new RequestClassMatcher(
      new RegExp(".*/profile")
    ) as any)
  ).thenResolve({
    body: JSON.stringify(TEST_USER_PROFILE),
    headers: {},
    statusCode: 200
  });

  // Link works if the access token is the same as the above
  when(
    requestClientMock.doRequest(new RequestClassMatcher(
      new RegExp(".*/login?link=true")
    ) as any)
  ).thenResolve({
    body: JSON.stringify(TEST_USER_PROFILE),
    headers: {},
    statusCode: 200
  });

  return requestClientMock;
}