/**
 * (c) Facebook, Inc. and its affiliates. Confidential and proprietary.
 */

//==============================================================================
// Welcome to scripting in Spark AR Studio! Helpful links:
//
// Scripting Basics - https://fb.me/spark-scripting-basics
// Reactive Programming - https://fb.me/spark-reactive-programming
// Scripting Object Reference - https://fb.me/spark-scripting-reference
// Changelogs - https://fb.me/spark-changelog
//
// For projects created with v87 onwards, JavaScript is always executed in strict mode.
//==============================================================================

// How to load in modules
const Scene = require('Scene')
const Patch = require('Patches')
const Time = require('Time')
const CANNON = require('cannon')
const FaceTracking = require('FaceTracking')
const ReactiveModule = require('Reactive')

// Use export keyword to make a symbol available in scripting debug console
export const Diagnostics = require('Diagnostics')

// Enables async/await in JS [part 1]
;(async function () {
  const _GAME = {
    makanable: false,
    mouthOpen: false,
    readyEat: false,
    started: false,
    count: 0,
    ended: false,
  }

  /** @type SceneObjectBase */
  const focalDistance = await Scene.root.findFirst('Focal Distance')

  const focalPos = focalDistance.transform.z.pinLastValue()

  /** @type SceneObjectBase */
  const sphere2 = await Scene.root.findFirst('Sphere0')
  /** @type SceneObjectBase */
  const KeruPux = await Scene.root.findFirst('kerupux')
  /** @type SceneObjectBase */
  const targetMulut = await Scene.root.findFirst('target-mulut')
  /** @type SceneObjectBase */
  const targetKerupuk = await Scene.root.findFirst('target-kerupuk')

  Patch.inputs.setPoint('mouthPos', targetMulut.worldTransform.position)
  Patch.inputs.setPoint('kerupukPos', targetKerupuk.worldTransform.position)

  const makanable = await Patch.outputs.getBoolean('makanable')
  const mouthOpen = await Patch.outputs.getBoolean('mouthOpen')
  const isGameStarted = await Patch.outputs.getPulse('started')

  Patch.inputs.setBoolean('kerupukVisible', true)

  isGameStarted.subscribe((e) => {
    if (!_GAME.started) _GAME.started = true
  })

  makanable.monitor().subscribe((e) => {
    _GAME.makanable = e.newValue
  })
  mouthOpen.monitor().subscribe((e) => {
    if (_GAME.ended === true) return
    _GAME.mouthOpen = e.newValue
    if (e.newValue) {
      _GAME.readyEat = true
    }

    if (
      e.newValue === false &&
      _GAME.readyEat &&
      _GAME.makanable &&
      _GAME.started
    ) {
      _GAME.count += 1
      _GAME.readyEat = false

      if (_GAME.count > 8) {
        _GAME.ended = true
        Patch.inputs.setPulse('finish', ReactiveModule.once())
        Patch.inputs.setBoolean('kerupukVisible', false)
      }
      Patch.inputs.setScalar('count', _GAME.count)
      Patch.inputs.setString('countString', 'counted : ' + _GAME.count)
    }
  })

  const sec = await Patch.outputs.getScalar('receiveSecond')
  sec.monitor().subscribe((e) => {
    if (_GAME.ended === true) return
    const d = Number(e.newValue)

    var h = Math.floor(d / 3600)
    var m = Math.floor((d % 3600) / 60)
    var s = Math.floor((d % 3600) % 60)

    Patch.inputs.setScalar('second', s)
    Patch.inputs.setScalar('minute', m)
    Patch.inputs.setScalar('hour', h)
    Patch.inputs.setString(
      'formated',
      ('0' + m).slice(-2) + ':' + ('0' + s).slice(-2)
    )
  })

  // const sec = await Patch.outputs.getScalar('')

  const face = FaceTracking.face(0)

  /** @type SceneObjectBase[] */
  const cubes = []

  for (let i = 0; i < 7; i++) {
    /** @type SceneObjectBase */
    const cube = await Scene.root.findFirst('Cube' + i)
    cubes.push(cube)
  }

  // Create cannon world and setting gravity
  const world = new CANNON.World()
  world.gravity.set(0, -5, 0)

  // Create sphere body and setting its shape and properties
  const radius = 1
  const sphereProps = {
    mass: 5,
    position: new CANNON.Vec3(0, 1, 0),
    radius: radius,
    shape: new CANNON.Sphere(radius),
  }

  const sphereBody = new CANNON.Body(sphereProps)
  world.addBody(sphereBody)

  /**
   * Added BOX
   */
  const boxes = []
  const size = 0.028
  const crupuxSize = 0.028
  let mass = 0
  const space = 0.0001 //0.01 * size
  const offset = -0.5
  let N = cubes.length,
    last

  let initialY = 0
  for (let i = 0; i < N; i++) {
    const posY = (N - i) * (size * 2 + 2 * space) + size * 2 + space + offset

    const boxbody = new CANNON.Body({ mass: mass })
    const boxShape = new CANNON.Box(
      new CANNON.Vec3(
        i === N ? crupuxSize : size * 0.2,
        i === N ? crupuxSize : size,
        size * 0.2
      )
    )

    if (i === 0) initialY = posY
    boxbody.position.set(0, posY, 0)

    boxbody.linearDamping = 0.01
    boxbody.angularDamping = 0.1
    boxbody.addShape(boxShape)
    world.add(boxbody)
    boxes.push(boxbody)

    if (i != 0) {
      var c1 = new CANNON.PointToPointConstraint(
        boxbody,
        new CANNON.Vec3(0, size + space, 0),
        last,
        new CANNON.Vec3(0, -size - space, 0)
      )
      var c2 = new CANNON.PointToPointConstraint(
        boxbody,
        new CANNON.Vec3(0, size + space, 0),
        last,
        new CANNON.Vec3(0, -size - space, 0)
      )
      world.addConstraint(c1)
      world.addConstraint(c2)
    } else {
      mass = 0.3
    }
    last = boxbody
  }

  /**
   * Added HEAD Body
   */
  const headSize = 0.07
  const headShape = new CANNON.Sphere(0.06)
  const headBody = new CANNON.Body({ mass: 0 })

  headBody.position.set(
    face.cameraTransform.position.x.pinLastValue(),
    face.cameraTransform.position.y.pinLastValue(),
    face.cameraTransform.position.z.pinLastValue()
  )
  headBody.quaternion.setFromEuler(
    face.cameraTransform.rotationX.pinLastValue(),
    face.cameraTransform.rotationY.pinLastValue(),
    face.cameraTransform.rotationZ.pinLastValue()
  )
  headBody.addShape(headShape)
  world.addBody(headBody)

  // Configure time step for Cannon
  const fixedTimeStep = 1 / 60
  const maxSubSteps = 3
  const timeInterval = 30
  let lastTime

  let xVal = 0
  let yVal = initialY

  sphere2.transform.position.x.monitor().subscribe((e) => {
    xVal = e.newValue
  })

  sphere2.transform.position.y.monitor().subscribe((e) => {
    yVal = initialY + e.newValue
  })

  const headPos = { x: 0, y: 0, z: 0 }
  const headRot = { x: 0, y: 0, z: 0 }

  face.cameraTransform.position.x.monitor().subscribe((e) => {
    headPos.x = e.newValue
  })
  face.cameraTransform.position.y.monitor().subscribe((e) => {
    headPos.y = e.newValue
  })
  face.cameraTransform.position.z.monitor().subscribe((e) => {
    headPos.z = e.newValue
  })

  face.cameraTransform.rotationX.monitor().subscribe((e) => {
    headRot.x = e.newValue
  })
  face.cameraTransform.rotationY.monitor().subscribe((e) => {
    headRot.y = e.newValue
  })
  face.cameraTransform.rotationZ.monitor().subscribe((e) => {
    headRot.z = e.newValue
  })

  // Create time interval loop for cannon
  Time.setInterval((time) => {
    if (lastTime !== undefined) {
      const posZ = headPos.z - focalPos

      boxes[0].position.x = headPos.x
      boxes[0].position.y = 0.4
      boxes[0].position.z = posZ < 0 ? 0 : posZ

      headBody.position.x = headPos.x
      headBody.position.y = headPos.y
      headBody.position.z = headPos.z - focalPos
      headBody.quaternion.x = headRot.x
      headBody.quaternion.y = headRot.y
      headBody.quaternion.z = headRot.z

      let dt = (time - lastTime) / 1000
      world.step(fixedTimeStep, dt, maxSubSteps)

      // sphere.transform.x = sphereBody.position.x
      // sphere.transform.y = sphereBody.position.y
      // sphere.transform.z = sphereBody.position.z

      KeruPux.transform.x = headBody.position.x
      KeruPux.transform.y = headBody.position.y
      KeruPux.transform.z = headBody.position.z
      KeruPux.transform.rotationX = headBody.quaternion.x
      KeruPux.transform.rotationY = headBody.quaternion.y
      KeruPux.transform.rotationZ = headBody.quaternion.z

      for (let i in boxes) {
        const cube = cubes[i]
        cube.transform.x = boxes[i].position.x
        cube.transform.y = boxes[i].position.y
        cube.transform.z = boxes[i].position.z

        // const rot = { x: 0, y: 0, z: 0 }
        // boxes[i].quaternion.toEuler(rot)

        // cube.transform.rotationX = rot.x
        // cube.transform.rotationY = rot.y
        // cube.transform.rotationZ = rot.z

        cube.transform.rotation = ReactiveModule.quaternion(
          boxes[i].quaternion.w,
          boxes[i].quaternion.x,
          boxes[i].quaternion.y,
          boxes[i].quaternion.z
        )
      }
    }

    lastTime = time
  }, timeInterval)

  // To use constiables and functions across files, use export/import keyword
  // export const animationDuration = 10;

  // Use import keyword to import a symbol from another file
  // import { animationDuration } from './script.js'

  // To access scene objects
  // const [directionalLight] = await Promise.all([
  //   Scene.root.findFirst('directionalLight0')
  // ]);

  // To access class properties
  // const directionalLightIntensity = directionalLight.intensity;

  // To log messages to the console
  // Diagnostics.log('Console message logged from the script.');

  // Enables async/await in JS [part 2]
})()
