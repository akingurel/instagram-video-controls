const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createPhotoDiscovery,
  findPhotoContext,
} = require("../src/photo-discovery.js");
const {
  FakeDocument,
  FakeImage,
  FakeNode,
  FakeObserver,
} = require("./helpers/fakes.js");

function setRect(element, { height, left = 0, top = 0, width }) {
  element.getBoundingClientRect = () => ({
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  });
  return element;
}

function createDocumentTree() {
  const document = new FakeDocument();
  const html = setRect(document.createElement("html"), { width: 1280, height: 900 });
  const body = setRect(document.createElement("body"), { width: 1280, height: 900 });
  document.documentElement = html;
  document.append(html);
  html.append(body);
  document.body = body;
  return { body, document, html };
}

function createWindow() {
  return {
    getComputedStyle(element) {
      return {
        display: element.computedDisplay || "block",
        visibility: element.computedVisibility || "visible",
      };
    },
  };
}

function createPostPhoto(document, {
  height = 500,
  naturalHeight = 1080,
  naturalWidth = 1080,
  width = 500,
} = {}) {
  const article = setRect(document.createElement("article"), { width, height: height + 80 });
  const container = setRect(document.createElement("div"), { width, height });
  const image = new FakeImage(document, {
    naturalHeight,
    naturalWidth,
    rect: { width, height, left: 0, top: 0 },
    src: "https://instagram.example/photo.jpg",
  });
  article.append(container);
  container.append(image);
  return { article, container, image };
}

function environment(pathname = "/p/example/") {
  return {
    location: { pathname },
    window: createWindow(),
  };
}

test("findPhotoContext accepts a visible post image", () => {
  const { body, document } = createDocumentTree();
  const { article, container, image } = createPostPhoto(document);
  body.append(article);

  assert.deepEqual(findPhotoContext(image, environment()), {
    container,
    image,
    kind: "post",
    mediaRoot: article,
  });
});

test("findPhotoContext accepts a visible Story image", () => {
  const { body, document } = createDocumentTree();
  const storySurface = setRect(document.createElement("section"), { width: 400, height: 700 });
  const image = new FakeImage(document, {
    naturalHeight: 1920,
    naturalWidth: 1080,
    rect: { width: 400, height: 700, left: 0, top: 0 },
  });
  body.append(storySurface);
  storySurface.append(image);

  assert.deepEqual(findPhotoContext(image, environment("/stories/example/1/")), {
    container: storySurface,
    image,
    kind: "story",
    mediaRoot: storySurface,
  });
});

test("findPhotoContext rejects avatars, profile grid thumbnails, video surfaces, and hidden slides", () => {
  const { body, document } = createDocumentTree();
  const header = document.createElement("header");
  const avatar = new FakeImage(document, {
    naturalHeight: 150,
    naturalWidth: 150,
    rect: { width: 44, height: 44, left: 0, top: 0 },
  });
  header.append(avatar);
  body.append(header);

  const gridThumbnail = new FakeImage(document, {
    naturalHeight: 1080,
    naturalWidth: 1080,
    rect: { width: 300, height: 300, left: 0, top: 0 },
  });
  body.append(gridThumbnail);

  const videoPost = createPostPhoto(document);
  const video = setRect(document.createElement("video"), { width: 500, height: 500 });
  videoPost.container.append(video);
  body.append(videoPost.article);

  const hiddenPost = createPostPhoto(document, { width: 0, height: 0 });
  body.append(hiddenPost.article);

  assert.equal(findPhotoContext(avatar, environment()), null);
  assert.equal(findPhotoContext(gridThumbnail, environment("/example/")), null);
  assert.equal(findPhotoContext(videoPost.image, environment()), null);
  assert.equal(findPhotoContext(hiddenPost.image, environment()), null);
});

test("findPhotoContext rejects aria-hidden, CSS-hidden, and undersized candidates", () => {
  const { body, document } = createDocumentTree();
  const ariaHidden = createPostPhoto(document);
  ariaHidden.image.setAttribute("aria-hidden", "true");
  body.append(ariaHidden.article);

  const cssHidden = createPostPhoto(document);
  cssHidden.image.computedDisplay = "none";
  body.append(cssHidden.article);

  const tooSmall = createPostPhoto(document, {
    width: 170,
    height: 600,
    naturalWidth: 1080,
    naturalHeight: 1920,
  });
  body.append(tooSmall.article);

  assert.equal(findPhotoContext(ariaHidden.image, environment()), null);
  assert.equal(findPhotoContext(cssHidden.image, environment()), null);
  assert.equal(findPhotoContext(tooSmall.image, environment()), null);
});

function createDiscoveryFixture() {
  FakeObserver.reset();
  const { body, document, html } = createDocumentTree();
  const first = createPostPhoto(document);
  const second = createPostPhoto(document);
  body.append(first.article);
  body.append(second.article);
  const enhanced = [];
  const discovery = createPhotoDiscovery({
    root: html,
    window: createWindow(),
    location: { pathname: "/p/example/" },
    MutationObserverClass: FakeObserver,
    enhance: (context) => enhanced.push(context),
  });
  return { body, discovery, document, enhanced, first, html, second };
}

test("photo discovery scans existing images once and disconnects on stop", () => {
  const fixture = createDiscoveryFixture();

  fixture.discovery.start();
  fixture.discovery.start();
  fixture.discovery.stop();

  assert.deepEqual(
    fixture.enhanced.map(({ image }) => image),
    [fixture.first.image, fixture.second.image],
  );
  assert.equal(FakeObserver.instances[0].disconnected, true);
});

test("photo discovery scans only added subtrees and suppresses duplicates", () => {
  const fixture = createDiscoveryFixture();
  fixture.discovery.start();
  const third = createPostPhoto(fixture.document);
  fixture.body.append(third.article);

  FakeObserver.instances[0].emit([
    { addedNodes: [fixture.first.image, third.article] },
  ]);

  assert.deepEqual(
    fixture.enhanced.map(({ image }) => image),
    [fixture.first.image, fixture.second.image, third.image],
  );
});

test("failed enhancement can retry and release allows safe reuse", () => {
  FakeObserver.reset();
  const { body, document, html } = createDocumentTree();
  const photo = createPostPhoto(document);
  body.append(photo.article);
  let attempts = 0;
  const discovery = createPhotoDiscovery({
    root: html,
    window: createWindow(),
    location: { pathname: "/p/example/" },
    MutationObserverClass: FakeObserver,
    enhance() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary failure");
      }
    },
  });

  discovery.start();
  FakeObserver.instances[0].emit([{ addedNodes: [photo.image] }]);
  discovery.release(photo.image);
  FakeObserver.instances[0].emit([{ addedNodes: [new FakeNode({ images: [photo.image] })] }]);

  assert.equal(attempts, 3);
});
