class Parent {
  constructor() {}
}

class Feature {
  constructor() {}
}

export class Child extends Parent {
  feature = new Feature();

  constructor() {
    console.log("before");

    super();

    console.log("after");
  }
}
