const test = require("node:test");
const assert = require("node:assert/strict");
const { FakeNode, FakeObserver } = require("./helpers/fakes.js");
const discoveryApi = require("../src/video-discovery.js");

function createFixture() {
  FakeObserver.reset();
  const videoA = new FakeNode({ isVideo: true });
  const videoB = new FakeNode({ isVideo: true });
  const videoC = new FakeNode({ isVideo: true });
  const root = new FakeNode({ videos: [videoA, videoB] });
  const enhanced = [];
  const discovery = discoveryApi.createVideoDiscovery({
    root,
    MutationObserverClass: FakeObserver,
    enhance: (video) => enhanced.push(video),
  });

  return { discovery, enhanced, root, videoA, videoB, videoC };
}

test("start enhances every existing video once", () => {
  const { discovery, enhanced, videoA, videoB } = createFixture();

  discovery.start();
  discovery.start();

  assert.deepEqual(enhanced, [videoA, videoB]);
});

test("observer scans only added subtrees and ignores duplicates", () => {
  const { discovery, enhanced, videoA, videoB, videoC } = createFixture();
  const subtreeContainingAAndC = new FakeNode({ videos: [videoA, videoC] });

  discovery.start();
  FakeObserver.instances[0].emit([{ addedNodes: [subtreeContainingAAndC] }]);

  assert.deepEqual(enhanced, [videoA, videoB, videoC]);
});

test("stop disconnects the observer", () => {
  const { discovery } = createFixture();

  discovery.start();
  discovery.stop();

  assert.equal(FakeObserver.instances[0].disconnected, true);
});

test("a failed enhancement does not stop later videos", () => {
  FakeObserver.reset();
  const videoA = new FakeNode({ isVideo: true });
  const videoB = new FakeNode({ isVideo: true });
  const enhanced = [];
  const discovery = discoveryApi.createVideoDiscovery({
    root: new FakeNode({ videos: [videoA, videoB] }),
    MutationObserverClass: FakeObserver,
    enhance: (video) => {
      if (video === videoA) {
        throw new Error("broken video");
      }
      enhanced.push(video);
    },
  });

  discovery.start();

  assert.deepEqual(enhanced, [videoB]);
});
