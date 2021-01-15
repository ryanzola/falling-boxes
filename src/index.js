import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { FilmPass } from "three/examples/jsm/postprocessing/FilmPass";
import * as OIMO from "oimo";

import * as dat from "dat.gui";
import Stats from "stats.js";
const stats = new Stats();

const vertexShader = document.getElementById("vertex").textContent;
const fragmentShader = document.getElementById("fragment").textContent;

const uniforms = {
  iTime: { type: "f", value: 0.0 },
  iResolution: { type: "v4", value: new THREE.Vector4() },
  iMouse: { type: "v2", value: new THREE.Vector2(0, 0) }
};

class Sketch {
  constructor(selector) {
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 1);

    this.container = document.getElementById(selector);
    this.container.appendChild(this.renderer.domElement);
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.mouse = new THREE.Vector2();
    this.clock = new THREE.Clock();

    // perspective
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.001,
      1000
    );

    this.camera.position.set(0, 0, 6);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.time = 0;
    this.paused = false;

    this.composerPass();
    this.setupResize();
    this.addObjects();
    this.createPhysics();
    this.resize();
    // this.settings();
    this.render();
    this.mouseMove();
  }

  settings() {
    let that = this;

    // STATS
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.domElement);
    stats.domElement.style.position = "absolute";
    stats.domElement.style.top = "0px";
    stats.domElement.style.left = "0px";

    // DAT GUI
    this.settings = {
      createBody: function () {
        that.createBody();
      }
    };

    this.gui = new dat.GUI();
    this.gui.add(this.settings, "createBody");
  }

  resize() {
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;

    this.camera.updateProjectionMatrix();
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this), false);
  }

  composerPass() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    var params = {
      exposure: 2,
      bloomStrength: 3,
      bloomThreshold: 0,
      bloomRadius: 1
    };

    this.pass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    this.pass.threshold = params.bloomThreshold;
    this.pass.strength = params.bloomStrength;
    this.pass.radius = params.bloomRadius;
    this.pass.renderToScreen = true;
    this.composer.addPass(this.pass);

    const filmPass = new FilmPass(
      0.5, // noise intensity
      0.5, // scanline intensity
      1024, // scanline count
      false // grayscale
    );
    filmPass.renderToScreen = true;
    this.composer.addPass(filmPass);
  }

  addObjects() {
    this.material = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms,
      vertexShader,
      fragmentShader
      // wireframe: true
    });

    this.geometry = new THREE.BoxBufferGeometry(1, 1, 1);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  createPhysics() {
    this.bodies = [];

    this.world = new OIMO.World({
      timestep: 1 / 60,
      iterations: 8,
      broadphase: 2, // 1 brute force, 2 sweep and prune, 3 volume tree
      worldscale: 1, // scale full world
      random: true, // randomize sample
      info: false, // calculate statistic or not
      gravity: [0, -9, 0]
    });

    this.body = this.world.add({
      type: "box", // type of shape : sphere, box, cylinder
      size: [1.01, 1.01, 1.01], // size of shape
      pos: [0, 0, 0], // start position in degree
      rot: [0, 0, 90], // start rotation in degree
      move: true, // dynamic or statique
      density: 1,
      noSleep: true,
      friction: 0.2,
      restitution: 0.2,
      belongsTo: 1, // The bits of the collision groups to which the shape belongs.
      collidesWith: 0xffffffff // The bits of the collision groups with which the shape collides.
    });

    this.ground = this.world.add({ size: [10, 1, 10], pos: [0, -3, 0] });

    this.camBody = this.world.add({ size: [1.02, 1.02, 1.02], pos: [0, 0, 6] });
  }

  createBody() {
    let o = {};

    let body = this.world.add({
      type: "box", // type of shape : sphere, box, cylinder
      size: [1, 1, 1], // size of shape
      pos: [0, 10, 0], // start position in degree
      rot: [0, 0, 90], // start rotation in degree
      move: true, // dynamic or statique
      density: 1,
      friction: 0.2,
      restitution: 0.2,
      belongsTo: 1, // The bits of the collision groups to which the shape belongs.
      collidesWith: 0xffffffff // The bits of the collision groups with which the shape collides.
    });

    let mesh = new THREE.Mesh(this.geometry, this.material);

    this.scene.add(mesh);

    o.body = body;
    o.mesh = mesh;

    this.bodies.push(o);
  }

  mouseMove() {
    let that = this;

    window.addEventListener(
      "mousemove",
      function (event) {
        that.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        that.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      },
      false
    );
  }

  stop() {
    this.paused = true;
  }

  play() {
    this.plaused = false;
  }

  randomInRange(to, from) {
    let x = Math.random() * (to - from);
    return x + from;
  }

  render() {
    let that = this;
    if (this.paused) return;
    this.time += this.clock.getDelta() * 0.09;

    stats.begin();
    let rand = Math.random();
    if (rand < 0.2 && this.bodies.length < 300) {
      that.createBody();
    }
    this.material.uniforms.iTime.value = this.time;
    this.world.step();

    this.bodies.forEach((b, i) => {
      b.mesh.position.copy(b.body.getPosition());
      b.mesh.quaternion.copy(b.body.getQuaternion());

      if (b.body.getPosition().y < -100) {
        const x = this.randomInRange(-2, 2);
        const y = this.randomInRange(12, 20);
        const z = this.randomInRange(-2, 2);
        b.body.resetPosition(x, y, z);

        // this.world.removeRigidBody(b.body);
        // this.scene.remove(b.mesh);
      }
    });
    stats.end();

    requestAnimationFrame(this.render.bind(this));

    // this.renderer.render(this.scene, this.camera);
    if (this.composer) this.composer.render();
  }
}

new Sketch("container");
