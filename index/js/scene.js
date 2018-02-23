if (!(Detector.webgl || Detector.webgl2)) {

    Detector.addGetWebGLMessage({
        fallbackImg: "img/nowebgl.jpg"
    })

} else {

    const useMRT = true

    let useVideoTextures = true
    let useDeferred      = true
    let useHDRMirrors    = true

    const backend  = Detector.webgl2 ? "webgl2" : "webgl1"
    const isMobile = Detector.isMobile

    const isChrome   = navigator.userAgent.toLowerCase().includes("chrome")
    const isSafari   = navigator.userAgent.toLowerCase().includes("safari") && !isChrome
    const isFirefox  = navigator.userAgent.toLowerCase().includes("firefox")
    const isExplorer = navigator.userAgent.toLowerCase().includes("trident")
    const isOSX      = navigator.platform.toLowerCase().includes("mac")


    if (!Detector.deferredCapable || isMobile) useDeferred = false
    if ((isOSX && isSafari) || isExplorer || isMobile) useVideoTextures = false
    if (isExplorer || isMobile) useHDRMirrors = false



    let isUltra = false
    const ULTRA_THRESHOLD = 4000

    const baseBlurScale  = 5
    const shadowDarkness = 1


    const BRIGHTNESS = 0.6
    const SCALE = 1 / window.devicePixelRatio

    let MARGIN = 80
    let SIDE_MARGIN = 0


    let WIDTH  = window.innerWidth  - 2 * SIDE_MARGIN
    let HEIGHT = window.innerHeight - 2 * MARGIN


    const FOV    = 40
    const ASPECT = WIDTH / HEIGHT
    const NEAR   = 1
    const FAR    = 1500

    const cameraViews = [90, 50, 60, 90, 60, 50, 30]
    let   cameraIndex = 0



    const videoConfigs = 
    [{
        "label" : "filament"
     ,  "vp9"   : "index/video/apostol.webm"
    }]

    let videos        = []
    let textureVideos = []
    let textureStatic = []

    let currentVideoIndex = -1



    let playingAudio = false

    let currentVolume     = 1
    let volumeChangeDir   = 1
    let volumeChangeSpeed = 2



    const dummyBlackMap = THREE.ImageUtils.generateDataTexture(4, 4, new THREE.Color(0x000000))
    dummyBlackMap.anisotropy = 8



    let audioElement

    const fadeMultiplier   = 0
    const currentSongSpeed = 0.09


    const lightFadeInSpeed  = 0.8
    const lightFadeOutSpeed = 0.8



    let isFrozen = false

    let clockSpeed = 1
    let clockSpeedChangeDir = 1



    let matIndex = 0

    const matConfig = [

        {
             "texSide"          : "filament"
        ,    "texMirrorBack"    : "index/textures/flare.jpg"
        ,    "texMirrorGround"  : "index/textures/floor.jpg"
        ,    "lightIntensity"   : 4
        ,    "particlesColor"   : [0.1, 0.3, 0.3]
        ,    "particlesEnabled" : 1
        }

    ]

    console.log("boxes", matConfig.length)

    const cache = {}

    let rightMaterial
    let planeLeft
    let planeRight
    let planeTop


    const skins = []

    let camera

    let scene
    let renderer
    let innerRenderer

    let effectColorCorrection
    let effectColor
    let effectSharpen
    let effectHeat
    let effectFilm
    let heatUniforms


    let rightLight
    let verticalMirror
    let groundMirror
    let debrisMesh
    let debrisMaterial
    let debrisMeshes = []

    const tmpColor = new THREE.Color()

    let loadCounter = 0


    const clock = new THREE.Clock()
    let clockElapsedTime = 0


    let mouseX = 0
    let mouseY = 0

    let targetX = 0.0
    let targetY = 0.0
    let angle   = 0.0
    let height  = 0.0

    const target = new THREE.Vector3(0, 20, 0)

    const windowHalfX = window.innerWidth / 2
    const windowHalfY = window.innerHeight / 2


    function init() {

        const pars = 
        {

             "scale"                    : SCALE
        ,    "antialias"                : true
        ,    "tonemapping"              : THREE.Filmic2015Operator
        ,    "brightness"               : BRIGHTNESS
        ,    "dither"                   : true
        ,    "backend"                  : backend
        ,    "useMultipleRenderTargets" : useMRT

        }

        if (useDeferred) {

            renderer = new THREE.DeferredRenderer(pars)
            renderer.useMultiProxies = true

        } else {

            pars.devicePixelRatio = 1.0

            renderer = new THREE.ForwardRenderer(pars)
            renderer.setClearColorHex(0x000000, 1)

        }

        innerRenderer = (renderer instanceof THREE.DeferredRenderer) ? renderer.renderer : renderer

        renderer.setSize(WIDTH, HEIGHT)

        renderer.shadowMapEnabled        = true
        renderer.shadowMapType           = isMobile ? THREE.PCFSoftShadowMap : THREE.PCFSoftHQShadowMap
        renderer.shadowMapSlopeDepthBias = true
        renderer.shadowMapSlopeScale     = 3
        renderer.shadowMapSlopeBias      = 0.0001

        renderer.shadowMapCullFace = THREE.CullFaceBack

        if (!isOSX) renderer.shadowMapUseDepthTextures = true


        if (useDeferred) {
            renderer.dofEnabled       = true
            renderer.dofAutofocus     = true
            renderer.dofFancy         = true
            renderer.dofLensFstop     = 1.7
            renderer.dofLensBlurScale = baseBlurScale
            renderer.dofFocusDistance = 1

            const fovRad = THREE.Math.degToRad(FOV)
            renderer.dofLensFocalLength = THREE.Math.fovToFocalLength(fovRad, 24)


            renderer.occludersEnabled = true
            renderer.bloomEnabled     = true


            effectSharpen = new THREE.ShaderPass(THREE.SharpenShader)
            effectSharpen.uniforms.resolution.value.set(WIDTH * SCALE, HEIGHT * SCALE)


            const noiseMap = THREE.ImageUtils.loadTexture("textures/rgbNoise.png")
            noiseMap.wrapS = noiseMap.wrapT = THREE.RepeatWrapping

            effectHeat = new THREE.ShaderPass(THREE.HeatHazeShader)
            effectHeat.uniforms.tNoise.value           = noiseMap
            effectHeat.uniforms.distortionScale.value  = 1.00
            effectHeat.uniforms.distortionFactor.value = 0.0025
            effectHeat.uniforms.riseFactor.value       = 0.3
            effectHeat.uniforms.startDistance.value    = 100.0
            effectHeat.uniforms.fineNoiseScale.value   = 0.2

            heatUniforms = effectHeat.uniforms


            effectFilm = new THREE.ShaderPass(THREE.SimpleFilmShader)
            effectFilm.material.uniforms.intensity.value = 0.175


            effectColor = new THREE.ShaderPass(THREE.ColorCorrectionShader)
            effectColor.material.uniforms.powRGB.value.set(1.5, 1.25, 1)


            renderer.addEffect(effectHeat, {
                "depthUniform": "tDepth"
            })
            renderer.addEffect(effectColor)
            renderer.addEffect(effectSharpen)
            renderer.addEffect(effectFilm)

        }


        renderer.domElement.style.position = "absolute"
        renderer.domElement.style.top      = `${MARGIN}px`
        renderer.domElement.style.left     = `${SIDE_MARGIN}px`

        const container = document.getElementById('container')
        container.appendChild(renderer.domElement)


        scene = new THREE.Scene()
        createScene()


        camera = new THREE.PerspectiveCamera(FOV, ASPECT, NEAR, FAR)
        camera.position.set(0, 50, 160)


        window.addEventListener('resize', onWindowResize, false)
        document.addEventListener('mousemove', onDocumentMouseMove, false)
        document.addEventListener('keydown', onKeyDown, false)
        renderer.domElement.addEventListener('touchmove', onTouchMove, false)


        for (let i = 0, il = videoConfigs.length ; i < il ; ++i) {

            const videoConfig = videoConfigs[i]
            const label       = videoConfig["label"]

            if (useVideoTextures) {

                const video = loadVideo(videoConfig)
                video.textureVideo.properties = {
                    "videoIndex": i
                }

                videos[i] = video.video
                textureVideos[i] = video.textureVideo

                cache[label] = video.textureVideo

            } else {

                const img = THREE.ImageUtils.loadTexture(videoConfig["img"])
                textureStatic[i] = img

                cache[label] = img

            }

            const tex = cache[label]
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping

        }


        matIndex = 0
        setBoxMaterials(matIndex)


        const gpuDetector = new GPUDetector()
        gpuDetected = gpuDetector.detectGPU()

        if (gpuDetected && gpuDetected.rawScore >= ULTRA_THRESHOLD) toggleUltra()

        initAudio()

    }



    function initAudio() {

        const generateSongEndHandler = index => () => {

            handleSongEnd(index)

        }


        audioElement = document.getElementById("song")
        audioElement.addEventListener("ended", generateSongEndHandler(0))

        audioElement.volume = 1
        audioElement.play()

        playingAudio = true

    }

    function handleSongEnd(songIndex) { audioElement.play() }



    function supportsVideo(videoElement) { return !!videoElement.canPlayType }

    function supportsWebmVideo(videoElement, codecs) {

        if (!supportsVideo(videoElement)) {

            return false

        }

        return videoElement.canPlayType(`video/webm codecs="${codecs}"`)

    }

    function loadVideo(formats) {

        const video = document.createElement('video')
        video.loop  = true
        video.src   = (supportsWebmVideo(video, "vp9") && formats["vp9"]) ? formats["vp9"] : formats["mp4"]

        const textureVideo           = new THREE.Texture(video)
        textureVideo.generateMipmaps = true
        textureVideo.format          = THREE.RGBFormat
        textureVideo.minFilter       = THREE.LinearMipMapLinearFilter
        textureVideo.magFilter       = THREE.LinearFilter
        textureVideo.wrapS           = THREE.ClampToEdgeWrapping
        textureVideo.wrapT           = THREE.ClampToEdgeWrapping

        return {
            "video": video,
            "textureVideo": textureVideo
        }

    }




    function createBox(parameters) {

        const root = new THREE.Node()

        const boxSize   = parameters.boxSize

        rightMaterial = new THREE.EmissiveMaterial({
            "color": 0xffffff
        })
        rightMaterial.occluder = true

        const mapSide = dummyBlackMap
        mapSide.format = THREE.RGBFormat
        mapSide.anisotropy = 8
        mapSide.repeat.multiplyScalar(0.5)
        mapSide.offset.set(-0.125, -0.125)

        rightMaterial.map         = mapSide
        rightMaterial.blending    = THREE.AdditiveBlending
        rightMaterial.side        = THREE.DoubleSide
        rightMaterial.transparent = true


        const planeGeo = new THREE.SphereGeometry(boxSize * 3, 32, 16, 0, Math.PI, Math.PI * 0.25, Math.PI * 0.5)


        planeRight            = new THREE.Mesh(planeGeo, rightMaterial)
        planeRight.position.x = boxSize * 0.5
        planeRight.position.y = boxSize * 1.65
        planeRight.rotation.y = -Math.PI / 2
        planeRight.scale.z    = 0
        planeRight.position.x = boxSize * 2.65
        root.add(planeRight)

        planeRight.receiveShadow = true

        return root

    }



    function createMirrors(parameters) {


        const glossMapMetal = THREE.ImageUtils.loadTexture("textures/floor.jpg")
        glossMapMetal.wrapS  = glossMapMetal.wrapT = THREE.RepeatWrapping
        glossMapMetal.format = THREE.RGBFormat
        glossMapMetal.anisotropy = 8


        const largeMirrorGeo2 = new THREE.PlaneGeometry(parameters.boxSize * 6, parameters.boxSize * 8)

        groundMirror = new THREE.MirrorSurface(innerRenderer, {

            "clipBias": 0.003,
            "textureWidth": 1024,
            "textureHeight": 1024,
            "specular": 0x666666,
            "glossMap": glossMapMetal,
            "gloss": 1.25,
            "repeat": [2, 4]

        })

        groundMirror.material.defines["USE_REFLECTION"] = true

        const groundMirrorMesh = new THREE.Mesh(largeMirrorGeo2, groundMirror.material)
        groundMirrorMesh.add(groundMirror)
        groundMirrorMesh.rotation.x = -Math.PI / 2
        scene.add(groundMirrorMesh)

        groundMirrorMesh.receiveShadow = true
        groundMirror.material.occluder = true


        if (useHDRMirrors) {

            const halfFloatType   = (backend === "webgl2") ? THREE.HalfFloatType2 : THREE.HalfFloatType1
            const halfFloatFormat = (backend === "webgl2") ? THREE.RGBA16F        : THREE.RGBAFormat

            groundMirror.texture.type     = halfFloatType
            groundMirror.tempTexture.type = halfFloatType

            groundMirror.texture.internalFormat     = halfFloatFormat
            groundMirror.tempTexture.internalFormat = halfFloatFormat

        }


        scene.properties.mirrors = [groundMirror]

    }



    function createScene() {

        const boxParameters = {

            "boxSize"   : 220 ,
            "boxAspect" : 2   ,

        }

        const box = createBox(boxParameters)
        scene.add(box)

        createMirrors(boxParameters)


        const d  = 50
        const py = 50
        const offset = 0.5

        const w = 50
        const h = 50

        const areaIntensity = 3


        rightLight = new THREE.PolyLight(0xffffff, areaIntensity)

        rightLight.width  = w * 1.25
        rightLight.height = h

        rightLight.normal.set(0, 0, 1)
        rightLight.position.set(d - offset, py, 0)

        scene.add(rightLight)

        setupAreaLight(rightLight, -1, 1, -1)

    //    rightLight.width = w/2
    //    addAreaLightMesh( rightLight )

        const numRings     = 7
        const numParticles = 2300

        for (let i = 0 ; i < numRings ; ++i) {

            addDebris(numParticles)

        }

        addHuman()

    }



    function setupAreaLight(light, tx, ty, tz) {

        light.castShadow = true

        light.shadowDarkness = shadowDarkness

        light.shadowCameraNear = 0.1
        light.shadowCameraFar  = 500

        light.shadowCameraOrtho = true

        const dd = 40

        light.shadowCameraLeft   = -dd
        light.shadowCameraRight  =  dd
        light.shadowCameraTop    =  dd
        light.shadowCameraBottom = -dd

        const nn = 0.5
        light.shadowMapWidth  = 512 * nn
        light.shadowMapHeight = 512 * nn


        light.target = new THREE.Node()
        light.target.position.copy(light.normal)
        light.add(light.target)

        const lightTarget = new THREE.Vector3()
        lightTarget.copy(light.position)
        lightTarget.x *= tx
        lightTarget.y *= ty
        lightTarget.z *= tz

        light.lookAt(lightTarget)

    }



    function addAreaLightMesh(light) {

        const geometry = new THREE.BoxGeometry(light.width * 2, light.height * 2, 0.1)

        const backColor  = new THREE.Color(0x333333)
        const frontColor = new THREE.Color(0xffffff)

        geometry.addAttribute("color", Float32Array, 3)
        geometry.setAttributeValue("color", backColor)
        geometry.setAttributeValue("color", frontColor, 48, 60)

        const material = new THREE.EmissiveMaterial({
             "color"         : 0xffffff
        ,    "vertexColors"  : true
        })

        material.color.copy(light.color)
        material.intensity = light.intensity
        material.occluder  = true

        const lightMesh = new THREE.Mesh(geometry, material)
        lightMesh.position.copy(light.position)
        lightMesh.rotation.copy(light.rotation)
        scene.add(lightMesh)

        lightMesh.castShadow = true

    }



    function addHuman() {

        const loader = new THREE.JSONLoader()
        loader.load("index/models/idle.js", (geometries, materials) => {
            materials[0].shininess = 2
            materials[1].shininess = 2
            materials[2].shininess = 2
            materials[3].shininess = 2
            materials[4].shininess = 2

            const object = new THREE.SkinnedMesh(geometries, materials)

            const s = 26.5
            const x =  -34
            const y = -0.5
            const z =    0

            object.position.set(x, y, z)
            object.scale.set(s, s, s)
            object.rotation.y = Math.PI * 0.5

            object.castShadow    = true
            object.receiveShadow = true

            scene.add(object)
            skins.push(object)

            object.playAnimation("idle")

        })

    }



    function addDebris(numTriangles) {
        const triangles = isMobile ? numTriangles : numTriangles * 2.8

        const geometry = new THREE.Geometry()
        geometry.numVertices = triangles * 3

        geometry.addAttribute("position", Float32Array, 3)
        geometry.addAttribute("normal",   Float32Array, 3)
        geometry.addAttribute("color",    Float32Array, 3)
        geometry.addAttribute("center",   Float32Array, 3)
        geometry.addAttribute("pars",     Float32Array, 3)

        const positions = geometry.attributes.position.array
        const normals   = geometry.attributes.normal.array
        const colors    = geometry.attributes.color.array
        const centers   = geometry.attributes.center.array
        const pars      = geometry.attributes.pars.array

        const color = new THREE.Color()

        let n  = 160
        let n2 = n / 2
        let d  = 1.5
        let d2 = d / 2

        const pA = new THREE.Vector3()
        const pB = new THREE.Vector3()
        const pC = new THREE.Vector3()
        const cb = new THREE.Vector3()
        const ab = new THREE.Vector3()

        for (let i = 0 ; i < positions.length ; i += 9) {

            d = Math.random()

            const r  = Math.random()
            const fi = Math.random() * Math.PI * 2

            const rsq = Math.sqrt(r) * n * 2.5

            const x = rsq * Math.cos(fi)
            const z = rsq * Math.sin(fi)

            const y = (Math.random() * n - n2) * 0.5

            const ax = x + Math.random() * d - d2
            const ay = y + Math.random() * d - d2
            const az = z + Math.random() * d - d2

            const bx = x + Math.random() * d - d2
            const by = y + Math.random() * d - d2
            const bz = z + Math.random() * d - d2

            const cx = x + Math.random() * d - d2
            const cy = y + Math.random() * d - d2
            const cz = z + Math.random() * d - d2

            positions[i + 0] = ax
            positions[i + 1] = ay
            positions[i + 2] = az

            positions[i + 3] = bx
            positions[i + 4] = by
            positions[i + 5] = bz

            positions[i + 6] = cx
            positions[i + 7] = cy
            positions[i + 8] = cz

            centers[i] = x
            centers[i + 1] = y
            centers[i + 2] = z

            centers[i + 3] = x
            centers[i + 4] = y
            centers[i + 5] = z

            centers[i + 6] = x
            centers[i + 7] = y
            centers[i + 8] = z


            pA.set(ax, ay, az)
            pB.set(bx, by, bz)
            pC.set(cx, cy, cz)

            cb.sub(pC, pB)
            ab.sub(pA, pB)
            cb.crossSelf(ab)
            cb.normalize()

            const nx = cb.x
            const ny = cb.y
            const nz = cb.z

            normals[i] = nx
            normals[i + 1] = ny
            normals[i + 2] = nz

            normals[i + 3] = nx
            normals[i + 4] = ny
            normals[i + 5] = nz

            normals[i + 6] = nx
            normals[i + 7] = ny
            normals[i + 8] = nz


            let vx = (x / n) + 0.5
            let vy = (y / n) + 0.5
            let vz = (z / n) + 0.5

            const dx = 0.25
            const dz = 0.5

            const dd = Math.sqrt((vx - dx) * (vx - dx) + (vz - dz) * (vz - dz))

            vx = THREE.Math.clamp(dd * 0.75, 0.0, 1.0)
            color.setRGB(vx, vx, vx)

            colors[i + 0] = color.r
            colors[i + 1] = color.g
            colors[i + 2] = color.b

            colors[i + 3] = color.r
            colors[i + 4] = color.g
            colors[i + 5] = color.b

            colors[i + 6] = color.r
            colors[i + 7] = color.g
            colors[i + 8] = color.b


            let px = THREE.Math.randomFloat(0, 1 / dd * 2)
            let py = THREE.Math.randomFloat(0, 6.28)
            let pz = THREE.Math.randomFloat(1, dd * 5)

            px = 1 / dd

            pars[i] = px
            pars[i + 1] = py
            pars[i + 2] = pz

            pars[i + 3] = px
            pars[i + 4] = py
            pars[i + 5] = pz

            pars[i + 6] = px
            pars[i + 7] = py
            pars[i + 8] = pz

        }

        geometry.computeBoundingSphere()

        if (!debrisMaterial) {

            debrisMaterial = new THREE.EmissiveMaterial({
                color: 0xffffff
            })
            debrisMaterial.color.setHSV(0.05, 1, 0.5)
            debrisMaterial.intensity = isMobile ? 1 : 16

            debrisMaterial.side         = THREE.DoubleSide
            debrisMaterial.occluder     = true
            debrisMaterial.vertexColors = true

        }

        debrisMesh = new THREE.Mesh(geometry, debrisMaterial)
        scene.add(debrisMesh)

        debrisMesh.properties.rotationSpeed = THREE.Math.randomFloat(0.75, 1.25)

        debrisMeshes.push(debrisMesh)
    }



    function onWindowResize(event) {
        event.preventDefault()

        WIDTH  = window.innerWidth  - 2 * SIDE_MARGIN
        HEIGHT = window.innerHeight - 2 * MARGIN

        renderer.setSize(WIDTH, HEIGHT)

        renderer.domElement.style.top  = `${MARGIN}px`
        renderer.domElement.style.left = `${SIDE_MARGIN}px`

        camera.aspect = WIDTH / HEIGHT
        camera.updateProjectionMatrix()

        if (useDeferred) {

            effectSharpen.uniforms.resolution.value.set(WIDTH * SCALE, HEIGHT * SCALE)

        }

    }

    function onDocumentMouseMove(event) {

        mouseX = (event.clientX - windowHalfX) * 1
        mouseY = (event.clientY - windowHalfY) * 1

    }

    function onTouchMove(event) {

        event.preventDefault()

        const touches = event.touches
        const touch = touches[0]

        mouseX = (touch.clientX - windowHalfX) * 1
        mouseY = (touch.clientY - windowHalfY) * 1

    }



    function setBoxMaterials(index) {

        const pars = matConfig[index]

        const sideLabel = pars.texSide

        const backURL   = pars.texMirrorBack
        const groundURL = pars.texMirrorGround

        const particlesColor   = pars.particlesColor
        const particlesEnabled = pars.particlesEnabled

        const lightIntensity = pars.lightIntensity

        if (cache[backURL] === undefined) {


            var texture = THREE.ImageUtils.loadTexture(backURL)

            texture.anisotropy = 8
            texture.format = THREE.RGBFormat

            cache[backURL] = texture

        }

        if (cache[groundURL] === undefined) {


            var texture = THREE.ImageUtils.loadTexture(groundURL)

            texture.anisotropy = 8
            texture.format     = THREE.RGBFormat
            texture.wrapS      = texture.wrapT = THREE.RepeatWrapping

            cache[groundURL] = texture

        }

        const mapSide         = cache[sideLabel]
        const mapMirrorGround = cache[groundURL]


        rightMaterial.map = mapSide
        planeRight.properties.deferredNeedsUpdate = true


        if (rightLight) {

            rightLight.texture = mapSide
            rightLight.textureBias = 2

        }

        let newVideoIndex = -1

        if (mapSide.image.tagName === "VIDEO") {

            newVideoIndex = mapSide.properties.videoIndex

        }

        if (newVideoIndex !== currentVideoIndex && currentVideoIndex >= 0) {

            const video = videos[currentVideoIndex]
            video.pause()

        }

        if (mapSide.image.tagName === "VIDEO") {

            mapSide.image.play()
            currentVideoIndex = newVideoIndex

            clockSpeedChangeDir = 1

        }


        const groundMirrorUniforms = groundMirror.material.uniforms
        groundMirrorUniforms.glossSampler.value = mapMirrorGround


        const h = particlesColor[0]
        const s = particlesColor[1]
        const v = particlesColor[2]

        debrisMaterial.color.setHSV(h, s, v)
        debrisMesh.visible = particlesEnabled


        rightLight.intensity = lightIntensity

    }


    function onKeyDown(event) {

        switch (event.keyCode) {

            case 90:
                /*Z*/
                toggleZoom()
                break

            case 68:
                /*D*/
                toggleDOF()
                break

            case 80:
                /*P*/
                toggleDebris()

            case 77:
                /*M*/
                toggleMargin()
                break

            case 85:
                /*U*/
                if (!event.ctrlKey) toggleUltra()
                break

        }

    }


    function setZoom(index) {

        const cc = cameraViews[index]

        camera.fov = cc
        camera.updateProjectionMatrix()

        const fovRad = THREE.Math.degToRad(camera.fov)
        renderer.dofLensFocalLength = THREE.Math.fovToFocalLength(fovRad, 24)

    }

    function toggleZoom() {
        // TODO: Mouse wheel
        cameraIndex = (cameraIndex + 1) % cameraViews.length
        setZoom(cameraIndex)

    }

    function toggleDebris() {

        if (useDeffered) matConfig[0].particlesEnabled = !matConfig[0].particlesEnabled

    }

    function toggleDOF() {

        if (useDeferred) renderer.setDOF(!renderer.dofEnabled)

    }


    function toggleUltra() {

        if (!useDeferred) return

        if (!isUltra) {

            renderer.setScale(1.5)
            renderer.dofLensBlurScale = baseBlurScale / 1.5
            isUltra = true

        } else {

            renderer.setScale(SCALE)
            renderer.dofLensBlurScale = baseBlurScale
            isUltra = false

        }

    }


    function toggleMargin() {

        MARGIN = MARGIN === 0 ? 80 : 0

        onWindowResize()

    }



    function animate() {

        requestAnimationFrame(animate)
        render()

    }



    function render() {

        let delta        = clock.getDelta()
        let rawDelta     = delta
        let retimedDelta = delta

        targetX = mouseX * 0.1
        targetY = mouseY * 0.01

        angle  += 0.05 * (targetX - angle)
        height += 0.05 * (targetY - height)

        const d  = 200
        const fi = Math.PI * 0.25

        const x = -Math.sin(angle * 0.02 + fi) * d
        const z =  Math.cos(angle * 0.02 + fi) * d
        const y = 15 * height + 100

        camera.position.set(x, y, z)
        camera.lookAt(target)

        clockSpeed = THREE.Math.clamp(clockSpeed + clockSpeedChangeDir * rawDelta, 0.0, 1.0)
        retimedDelta = delta * currentSongSpeed * clockSpeed
        clockElapsedTime += retimedDelta * 44


        if (clockSpeed === 0.0 && playingAudio) {

            audioElement.pause()
            playingAudio = false

        }

        if (clockSpeed > 0.0 && !playingAudio) {

            audioElement.play()
            playingAudio = true

        }

        currentVolume = THREE.Math.clamp(currentVolume + volumeChangeDir * volumeChangeSpeed * rawDelta, 0.0, 1.0)
        audioElement.volume = currentVolume * clockSpeed


        if (!useDeferred) {

            groundMirror.render(scene, camera)

        }


        if (heatUniforms) {

            heatUniforms.time.value += retimedDelta * 3
            heatUniforms.cameraNearFar.value.set(camera.near, camera.far)

        }


        renderer.dofFocusDistance = THREE.Math.clamp(renderer.dofFocusDistance + rawDelta * 30, 1.0, 120.0)


        if (useVideoTextures) {

            const video = videos[currentVideoIndex]
            const textureVideo = textureVideos[currentVideoIndex]

            if (video.readyState === video.HAVE_ENOUGH_DATA && !video.paused) {

                textureVideo.needsUpdate = true

            }

        }

        for (var i = 0 , il = skins.length ; i < il ; ++i) {

            skins[i].update(retimedDelta)

        }

        for (var i = 0, il = debrisMeshes.length ; i < il ; ++i) {

            const dm    = debrisMeshes[i]
            const speed = dm.properties.rotationSpeed

            dm.rotation.y += retimedDelta * 0.15 * speed

        }

        if (effectFilm) {

            effectFilm.material.uniforms.time.value += 0.01

        }

        renderer.render(scene, camera)

    }

    init()
    animate()

}