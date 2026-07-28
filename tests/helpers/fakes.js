class FakeNode {
  constructor({ isVideo = false, videos = [] } = {}) {
    this.isVideo = isVideo;
    this.videos = videos;
  }

  matches(selector) {
    return selector === "video" && this.isVideo;
  }

  querySelectorAll(selector) {
    return selector === "video" ? this.videos : [];
  }
}

class FakeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    FakeObserver.instances.push(this);
  }

  observe(target, options) {
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.disconnected = true;
  }

  emit(records) {
    this.callback(records);
  }

  static reset() {
    FakeObserver.instances = [];
  }
}

module.exports = { FakeNode, FakeObserver };
