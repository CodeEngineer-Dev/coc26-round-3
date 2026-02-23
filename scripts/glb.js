/*

This library supports loading in base64 string representations of .glb files. GLB is a binary format for representing and transmitting 3D models.

Uses right handed coordinates.

Supports:
- Solid colored geometry
- Textured geometry
- Emissive materials
- Phong lighting
- Directional lighting
- Multiple point lights
- Multiple spotlights

Currently does not support:
- Emissive textures
- Transparency
- Skeletal animation
- Full PBR lighting
and a million other things. Ideally, keep your models relatively simple.

Dependencies:
- glMatrix. Fast and small matrix library, this is built on it. https://cdn.jsdelivr.net/npm/gl-matrix@3.4.4/gl-matrix-min.min.js
- UPNG. Used to convert arrays of bytes representing a PNG into a color byte array. https://cdnjs.cloudflare.com/ajax/libs/upng-js/2.1.0/UPNG.min.js
- pako. A dependency of UPNG, used for inflating/compressing PNG data. https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js




TODO: Add in tangents so that normals work properly.

*/
const { Renderer, RenderComponent } = (function () {
  const MAX_POINT_LIGHTS = 100;
  const MAX_SPOT_LIGHTS = 1;

  /**
   * Asset manager for the renderer. Loads models and stores meshes, materials, and textures.
   *
   * @class AssetManager
   * @typedef {AssetManager}
   */
  class AssetManager {
    /**
     * Creates an instance of AssetManager.
     *
     * @constructor
     * @param {WebGL2RenderingContext} gl Must be a WebGL2RenderingContext.
     */
    constructor(gl) {
      this.gl = gl;
      this.meshes = {};
      this.materials = {};
      this.textures = {};
      this.scenes = {};
      this.nodes = {};
    }
    /**
     * Takes an array buffer representing a GLB file and splits it into its JSON and binary sections.
     *
     * @private
     * @param {ArrayBuffer} data
     * @returns {{ json: object; bin: Uint8Array; }}
     */
    parseGLB(data) {
      // Get a view of the array buffer so that values can be accessed.
      const buffer = new DataView(data);
      // Pull out the header chunk of the file.
      const header_chunk = {
        magic: buffer.getUint32(0, true),
        version: buffer.getUint32(4, true),
        length: buffer.getUint32(8, true),
      };
      // Verify that the file is valid .glb.
      if (header_chunk.magic != 0x46546c67)
        throw new Error("Not a valid .glb file.");
      // Pull out the JSON chunk.
      const json_chunk = {
        length: buffer.getUint32(12, true),
        type: buffer.getUint32(16, true),
        data: new Uint8Array(data, 20, buffer.getUint32(12, true)),
      };
      // Check JSON chunk validity.
      if (json_chunk.type != 0x4e4f534a)
        throw new Error("Not a valid type for a JSON chunk.");
      // Decode the JSON chunk bytes into a string.
      const decoder = new TextDecoder("utf-8");
      const decodedString = decoder.decode(json_chunk.data);
      const json = JSON.parse(decodedString);
      // Get the binary chunk that comes right after the JSON.
      const binary_chunk = {
        length: buffer.getUint32(20 + buffer.getUint32(12, true), true),
        type: buffer.getUint32(20 + buffer.getUint32(12, true) + 4, true),
        data: new Uint8Array(
          data,
          20 + buffer.getUint32(12, true) + 8,
          buffer.getUint32(20 + buffer.getUint32(12, true), true),
        ),
      };
      // Check binary chunk validity
      if (binary_chunk.type != 0x004e4942)
        throw new Error("Not a valid type for a binary chunk.");
      // Return the parsed json and the binary as an array of byters.
      return {
        json,
        bin: binary_chunk.data,
      };
    }
    /**
     * Loads a model into the asset manager from a base64 string representing a .glb file.
     *
     * @param {string} name Name of the .glb file
     * @param {string} base64 String representation of the .glb file
     */
    loadFromBase64(name, base64) {
      // Convert the string to binary.
      const binStr = window.atob(base64);
      // Get the number of bytes and allocate that amount of memory.
      const l = binStr.length;
      const bytes = new Uint8Array(l);
      // Walk through the string and convert each character into its corresponding byte.
      for (let i = 0; i < l; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      // Get the underlying array buffer.
      const data = bytes.buffer;
      // Pass that to parseGLB() for parsing.
      const parsedData = this.parseGLB(data);
      // Load the data into the asset manager.
      this.loadModel(name, parsedData.json, parsedData.bin);
    }
    /**
     * Loads a model into the asset manager from a URL that links a .glb file. If loading multiple models, use Promise.all().then().
     *
     * @async
     * @param {string} name
     * @param {string} url
     * @returns {Promise}
     */
    async loadFromURL(name, url) {
      // Get the file from the url.
      const response = await fetch(url);
      // Throw error if something is wrong.
      if (!response.ok) throw new Error(`Response status: ${response.status}`);
      // Get the array buffer from the response.
      const data = await response.arrayBuffer();
      // Parse data
      const { json, bin } = this.parseGLB(data);
      // Load data into asset manager
      this.loadModel(name, json, bin);
    }
    /**
     * Takes JSON and binary chunks and uploads meshes, materials, and textures to GPU.
     *
     * @private
     * @param {string} name Name of the file. Will be used as folder name for meshes.
     * @param {object} json JSON part of .glb file.
     * @param {Uint8Array} binary Binary part of .glb file.
     */
    loadModel(name, json, binary) {
      // Get the array of materials and add them to materials under a "folder".
      const materials = json.materials.map((material) => {
        return structuredClone(material);
      });
      this.materials[name] = materials;

      // Textures require images, samplers, and textures to exist in the JSON.
      if ("images" in json && "samplers" in json && "textures" in json) {
        // Load images
        const images = json.images.map((image) => {
          // Get the image's binary.
          const bufferView = json.bufferViews[image.bufferView];
          const imageData = binary.slice(
            bufferView.byteOffset,
            bufferView.byteOffset + bufferView.byteLength,
          );
          // Must be PNG images
          const mimeType = image.mimeType;
          if (mimeType != "image/png")
            throw new Error("Image in .glb is not a PNG format!");
          // Decode the PNG bytes into RGBA array.
          const imageDataDecoded = UPNG.decode(imageData.buffer);
          const imageRGBAArrayBuffer = UPNG.toRGBA8(imageDataDecoded)[0];
          const imageRGBA = new Uint8Array(imageRGBAArrayBuffer);
          // Return the image as that RGBA array along with width and height.
          return {
            imageRGBA,
            width: imageDataDecoded.width,
            height: imageDataDecoded.height,
          };
        });
        // Clone samplers.
        const samplers = json.samplers.map((sampler) =>
          structuredClone(sampler),
        );
        // Map each texture to a texture location on GPU and store in textures.
        const textures = json.textures.map((texture) => {
          // Sampler is currently unused because I'm not using the gltf specs.
          const sampler = samplers[texture.sampler];
          // Get corresponding image.
          const imageData = images[texture.source];
          // Bind texture to GPU.
          const textureGPU = this.gl.createTexture();
          this.gl.bindTexture(this.gl.TEXTURE_2D, textureGPU);

          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_MIN_FILTER,
            sampler.minFilter,
          );
          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_MAG_FILTER,
            sampler.magFilter,
          );
          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_WRAP_S,
            this.gl.CLAMP_TO_EDGE,
          );
          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_WRAP_T,
            this.gl.CLAMP_TO_EDGE,
          );
          // Upload texture
          this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            imageData.width,
            imageData.height,
            0,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            imageData.imageRGBA,
          );
          this.gl.generateMipmap(this.gl.TEXTURE_2D);
          return textureGPU;
        });
        this.textures[name] = textures;
      }
      // This object maps component type to the number of components in that type.
      const componentCounts = {
        SCALAR: 1,
        VEC2: 2,
        VEC3: 3,
        VEC4: 4,
        MAT2: 4,
        MAT3: 9,
        MAT4: 16,
      };
      // This object maps attribute types to their location as given in the shader program.
      const attributeLocations = {
        POSITION: 0,
        NORMAL: 1,
        TEXCOORD_0: 2,
        TANGENT: 3,
      };
      // Map each JSON buffer to a buffer location on the GPU. Note that there is generally only one buffer for .glb files.
      const glBuffers = json.buffers.map((bufferInfo) => {
        // Even though the vertex array buffer and element array buffer use the same data, WebGL requires that they be separate buffers.
        const vbo = this.gl.createBuffer();
        const ebo = this.gl.createBuffer();
        // Get the data for this bufer
        const bufferData = binary.slice(0, bufferInfo.byteLength);
        // Upload the same data to each buffer. It is double the space, less efficient. But should be no big deal for modern GPUs.
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bufferData(
          this.gl.ARRAY_BUFFER,
          bufferData,
          this.gl.STATIC_DRAW,
        );
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ebo);
        this.gl.bufferData(
          this.gl.ELEMENT_ARRAY_BUFFER,
          bufferData,
          this.gl.STATIC_DRAW,
        );
        return {
          vbo,
          ebo,
        };
      });
      // Map each mesh to an object containing it's name and it's primitives.
      const meshes = json.meshes.map((mesh) => {
        return {
          name: mesh.name,
          primitives: mesh.primitives.map((primitive) => {
            // Primitives each have a vao.
            const vao = this.gl.createVertexArray();
            this.gl.bindVertexArray(vao);
            // Getting minimum and maximum local coordinates for later use in frustum culling.
            let vMin = [0, 0, 0];
            let vMax = [0, 0, 0];
            // Right now there are only four attributes being used: POSITION, NORMAL, and TEXCOORD_0.
            Object.entries(primitive.attributes).forEach((param) => {
              // Get the accessor for the attribute.
              const [attributeName, accessorId] = param;
              const accessor = json.accessors[accessorId];
              // Set maximum and minimum vertex coordinates.
              if (attributeName == "POSITION") {
                vMin = structuredClone(accessor.min);
                vMax = structuredClone(accessor.max);
              }
              // Get the associated buffer view and vertex buffer object.
              const bufferView = json.bufferViews[accessor.bufferView];
              const vbo = glBuffers[bufferView.buffer].vbo;
              // Get the location of the attribute.
              const location = attributeLocations[attributeName];
              // Bind the attribute to the correct location in the vertex buffer object.
              this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
              this.gl.enableVertexAttribArray(location);
              this.gl.vertexAttribPointer(
                location,
                componentCounts[accessor.type],
                accessor.componentType,
                false,
                bufferView.byteStride || 0,
                (bufferView.byteOffset || 0) + (accessor.byteOffset || 0),
              );
            });
            // Bind the indice data to the EBO.
            const indexAccessor = json.accessors[primitive.indices];
            const indexBufferView = json.bufferViews[indexAccessor.bufferView];
            const ebo = glBuffers[indexBufferView.buffer].ebo;
            this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ebo);
            // Set to null as we are done with the current primitive.
            this.gl.bindVertexArray(null);
            // Return an object with the necessary drawing data.

            return {
              vao: vao,
              mode: primitive.mode || this.gl.TRIANGLES,
              count: indexAccessor.count,
              type: indexAccessor.componentType,
              offset:
                (indexBufferView.byteOffset || 0) +
                (indexAccessor.byteOffset || 0),
              material: {
                folder: name,
                index: primitive.material,
              },
              vMin: glMatrix.vec3.fromValues(vMin[0], vMin[1], vMin[2]),
              vMax: glMatrix.vec3.fromValues(vMax[0], vMax[1], vMax[2]),
            };
          }),
        };
      });
      /// END AI CODE
      // Put the meshes into the meshes object under the correct "folder".
      for (const mesh of meshes) {
        this.meshes[`${name}/${mesh.name}`] = mesh;
      }

      // Now let's get the scene and it's nodes

      const scenes = json.scenes.map((scene) => structuredClone(scene));
      const nodes = structuredClone(json.nodes).map((node) => {
        if ("mesh" in node) {
          return {
            ...node,
            mesh: name + "/" + meshes[node.mesh].name,
          };
        } else {
          return {
            ...node,
          };
        }
      });

      for (const scene of scenes) {
        this.scenes[`${name}/${scene.name}`] = scene;
      }
      this.nodes[name] = nodes;
    }
    /**
     * Return a mesh given a mesh path.
     *
     * @param {string} meshPath Must be in the form "folder/meshName". Mesh names are determined by what name the model creator gave it. Use a modelling software to view names.
     * @returns {Mesh}
     */
    getMesh(meshPath) {
      return this.meshes[meshPath];
    }
    /**
     * Returns a material given a folder name and an index.
     *
     * @param {string} folder
     * @param {number} index
     * @returns {Material}
     */
    getMaterial(folder, index) {
      return this.materials[folder][index];
    }
    /**
     * Returns a texture location given a folder name and an index.
     *
     * @param {string} folder
     * @param {number} index
     * @returns {WebGLTexture}
     */
    getTexture(folder, index) {
      return this.textures[folder][index];
    }
  }
  /**
   * Transform component. Stores data about transformations.
   *
   * @class Transform
   * @typedef {Transform}
   */
  class Transform {
    /**
     * Creates an instance of Transform with default values of no transformations.
     *
     * @constructor
     */
    constructor(transforms = {}) {
      this.translation =
        "translation" in transforms
          ? glMatrix.vec3.clone(transforms.translation)
          : glMatrix.vec3.create();
      this.rotation =
        "rotation" in transforms
          ? glMatrix.quat.clone(transforms.rotation)
          : glMatrix.quat.create();
      this.scale =
        "scale" in transforms
          ? glMatrix.vec3.clone(transforms.scale)
          : glMatrix.vec3.fromValues(1, 1, 1);
      this.matrix = glMatrix.mat4.create();
      this.normalMatrix = glMatrix.mat3.create();
      // Used to determine if the matrix needs recalculation after transforms change.
      this.isDirty = true;
      this.utilMatrix = glMatrix.mat4.create();
      this.globalForward = glMatrix.vec3.fromValues(0, 0, -1);
      this.globalUp = glMatrix.vec3.fromValues(0, 1, 0);
      this.globalRight = glMatrix.vec3.fromValues(1, 0, 0);
      this.forward = glMatrix.vec3.fromValues(0, 0, -1);
      this.up = glMatrix.vec3.fromValues(0, 1, 0);
      this.right = glMatrix.vec3.fromValues(1, 0, 0);
    }
    /**
     * Set the translation.
     *
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setTranslation(x, y, z) {
      glMatrix.vec3.set(this.translation, x, y, z);
      this.isDirty = true;
    }
    /**
     * Set the rotation in degrees.
     *
     * @param {number} pitch Rotation around the x-axis.
     * @param {number} yaw Rotation around the y-axis.
     * @param {number} roll Rotation around the z-axis.
     * @param {?boolean} [c] Optional boolean to enable pitch clamping, preventing gimbal lock. Set to true for uses like player view rotation.
     */
    setRotation(pitch, yaw, roll, c) {
      if (c === true) {
        pitch = clamp(pitch, -89.9, 89.9);
      }
      glMatrix.quat.fromEuler(this.rotation, pitch, yaw, roll);
      this.isDirty = true;
    }
    setRotationQuaternion(quaternion) {
      glMatrix.quat.copy(this.rotation, quaternion);
      this.isDirty = true;
    }

    getAngle(axis) {
      let axisVec;
      if (axis == "x") {
        axisVec = [1, 0, 0];
      } else if (axis == "y") {
        axisVec = [0, 1, 0];
      } else {
        axisVec = [0, 0, -1];
      }
      return glMatrix.quat.getAxisAngle(axisVec, this.rotation);
    }

    /**
     * Set the scale.
     *
     * @param {number} x
     * @param {number} y
     * @param {number} z
     */
    setScale(x, y, z) {
      glMatrix.vec3.set(this.scale, x, y, z);
      this.isDirty = true;
    }
    /**
     * Set transforms to look towards a position.
     *
     * @param {[number, number, number]} position Point to look at
     * @param {?[number, number, number]} [up=[0, 1, 0]] Up vector, defaults to [0, 1, 0]
     */
    setLookTowards(position, up = [0, 1, 0]) {
      glMatrix.mat4.targetTo(this.matrix, this.translation, position, up);
      glMatrix.mat4.getRotation(this.rotation, this.matrix);
      glMatrix.mat4.getScaling(this.scale, this.matrix);
    }
    /**
     * Returns transformation matrix
     *
     * @returns {glMatrix.mat4}
     */
    getTransformationMatrix() {
      // If the transforms have been changed, we need to recalculate the transformation matrix.
      if (this.isDirty) {
        glMatrix.mat4.fromRotationTranslationScale(
          this.matrix,
          this.rotation,
          this.translation,
          this.scale,
        );
        this.isDirty = false;
      }
      return this.matrix;
    }
    /**
     * Returns normal matrix
     *
     * @returns {glMatrix.mat3}
     */
    getNormalMatrix() {
      // Calculate transformation matrix.
      glMatrix.mat4.fromRotationTranslationScale(
        this.matrix,
        this.rotation,
        this.translation,
        this.scale,
      );
      // Invert the matrix, transpose it, and take the upper 3x3 to get the normal matrix.
      glMatrix.mat4.invert(this.utilMatrix, this.matrix);
      glMatrix.mat4.transpose(this.utilMatrix, this.utilMatrix);
      glMatrix.mat3.fromMat4(this.normalMatrix, this.utilMatrix);
      return this.normalMatrix;
    }
    /**
     * Get the forward vector of the transformation
     *
     * @returns {glMatrix.vec3}
     */
    getForward() {
      glMatrix.vec3.transformQuat(
        this.forward,
        this.globalForward,
        this.rotation,
      );
      return this.forward;
    }
    /**
     * Get the up vector of the transformation
     *
     * @returns {glMatrix.vec3}
     */
    getUp() {
      glMatrix.vec3.transformQuat(this.up, this.globalUp, this.rotation);
      return this.up;
    }
    /**
     * Get the right vector of the transformation
     *
     * @returns {glMatrix.vec3}
     */
    getRight() {
      glMatrix.vec3.transformQuat(this.right, this.globalRight, this.rotation);
      return this.right;
    }
  }
  /**
   * Render component. Store data renderer needs to know to render an object.
   *
   * @class RenderComponent
   * @typedef {RenderComponent}
   */
  class RenderComponent {
    /**
     * Creates an instance of RenderComponent.
     *
     * @constructor
     * @param {string} meshPath Mesh path in the form "fileName/meshName"
     * @param {?EmissiveComponent} [emissive] If defined, contains properties needed for emissive meshes.
     * @param {?number} [emissive.strength] Emissive strength
     * @param {?number} [emissive.color] Emissive color
     * @param {?LightComponent} [light] If defined, contains properties needed for light meshes. Mesh must contain primitive.
     * @param {?string} [light.lightType] Either "point" or "spot"
     * @param {?lightRange} [light.lightRange] Determines range of light
     * @param {?direction} [light.direction] Used for spot lights, determines direction of spot light.
     * @param {?cutOff} [light.cutOff] Used for spot lights, cosine of angle in radians swept by spotlight
     * @param {?outerCutOff} [light.outerCutOff] Used for spot lights, cosine of angle in radians at which spotlight ends completely
     *
     */
    constructor(meshPath, transforms, emissive, light) {
      this.mesh = meshPath;
      this.transform = new Transform(transforms);
      this.emissive = emissive || null;
      this.light = light || null;
    }
  }
  /**
   * Camera class, stores data about camera and view.
   *
   * @class Camera
   * @typedef {Camera}
   */
  class Camera {
    /**
     * Creates an instance of Camera.
     *
     * @constructor
     */
    constructor() {
      this.transform = new Transform();
      this.viewMatrix = glMatrix.mat4.create();
      this.near = 0.1;
      this.far = 100;
      this.fovy = glMatrix.glMatrix.toRadian(100.0);
      // Properly initialize view matrix
      glMatrix.mat4.invert(
        this.viewMatrix,
        this.transform.getTransformationMatrix(),
      );
    }
    /**
     * Return view matrix.
     *
     * @returns {glMatrix.mat4}
     */
    getViewMatrix() {
      if (this.transform.isDirty) {
        glMatrix.mat4.invert(
          this.viewMatrix,
          this.transform.getTransformationMatrix(),
        );
      }
      return this.viewMatrix;
    }
  }
  /**
   * Scene class, stores scene list and handles adding and removing render components.
   *
   * @class Scene
   * @typedef {Scene}
   */
  class Scene {
    /**
     * Creates an instance of Scene.
     *
     * @constructor
     */
    constructor(assetManager) {
      this.componentList = [];
      this.camera = new Camera();
      this.assetManager = assetManager;
    }
    /**
     * Add render component to scene list
     *
     * @param {RenderComponent} component
     */
    addComponent(component) {
      if (component instanceof RenderComponent) {
        this.componentList.push({
          name: "who cares lol",
          renderComponent: component,
          parent: null,
          worldMatrix: glMatrix.mat4.create(),
        });
      } else {
        this.componentList.push(component);
      }
    }
    /**
     * Remove render component from scene list
     *
     * @param {RenderComponent} component
     */
    removeComponent(component) {
      // This is swap and pop for removing elements from arrays.
      let entityIndex = this.componentList.indexOf(component);
      if (entityIndex != -1) {
        this.componentList[entityIndex] =
          this.componentList[this.componentList.length - 1];
        this.componentList.pop();
      }
    }
    crawlNode(nodeList, node, parent = null) {
      if ("camera" in node) {
        this.camera.transform.setTranslation(
          ...(node.translation ? node.translation : [0, 0, 0]),
        );
        this.camera.transform.setRotationQuaternion(
          ...(node.rotation ? node.rotation : glMatrix.quat.create()),
        );
        this.camera.transform.setScale(
          ...(node.scale ? node.scale : [1, 1, 1]),
        );
      } else {
        let renderComponent = new RenderComponent(node.mesh ?? null, node);
        renderComponent.transform.isDirty = true;

        let obj = {
          name: node.name,
          renderComponent,
          parent,
          worldMatrix: glMatrix.mat4.create(),
          worldDirty: true,
        };

        if ("children" in node) {
          obj.children = node.children.map((childNodeIndex) =>
            this.crawlNode(nodeList, nodeList[childNodeIndex], obj),
          );
        }

        return obj;
      }
    }

    loadScene(scenePath) {
      for (let nodeIndex of this.assetManager.scenes[scenePath].nodes) {
        let node = this.assetManager.nodes[scenePath.split("/")[0]][nodeIndex];
        let convertedNode = this.crawlNode(
          this.assetManager.nodes[scenePath.split("/")[0]],
          node,
        );
        if (convertedNode) this.componentList.push(convertedNode);
      }
      return this.componentList;
    }

    updateNodeWorldTransform(node, parentWorldMatrix) {
      if (node.renderComponent.transform.isDirty || node.worldDirty) {
        if (parentWorldMatrix) {
          glMatrix.mat4.multiply(
            node.worldMatrix,
            parentWorldMatrix,
            node.renderComponent.transform.getTransformationMatrix(),
          );
        } else {
          glMatrix.mat4.copy(
            node.worldMatrix,
            node.renderComponent.transform.getTransformationMatrix(),
          );
        }
      }

      if ("children" in node) {
        for (const child of node.children) {
          child.worldDirty = true;
          this.updateNodeWorldTransform(child, node.worldMatrix);
        }
      }

      node.worldDirty = false;
    }
    updateNodesTree() {
      for (const node of this.componentList) {
        this.updateNodeWorldTransform(node);
      }
    }
  }
  /**
   * Shader class for compiling and linking shader programs.
   *
   * @class Shader
   * @typedef {Shader}
   */
  class Shader {
    /**
     * Compiles GLSL shader code.
     *
     * @static
     * @param {WebGL2RenderingContext} glContext
     * @param {string} shaderSourceCode
     * @param {("vertex" | "fragment")} typeName
     * @returns {WebGLShader}
     */
    static compileShader(glContext, shaderSourceCode, typeName) {
      // Determine which type of shader we're compiling.
      let type = 0;
      if (typeName == "vertex") type = glContext.VERTEX_SHADER;
      else if (typeName == "fragment") type = glContext.FRAGMENT_SHADER;
      // Create the shader
      const shader = glContext.createShader(type);
      if (shader == null) throw new Error("Cannot create WebGL shader.");
      // Give the shader the code and compile.
      glContext.shaderSource(shader, shaderSourceCode);
      glContext.compileShader(shader);
      // Throw an error if something goes wrong.
      let shaderTypeString = `${
        type == glContext.VERTEX_SHADER
          ? "Vertex"
          : type == glContext.FRAGMENT_SHADER
            ? "Fragment"
            : () => {
                throw "Not a valid GLEnum type for shaders. Use either gl.VERTEX_SHADER or gl.FRAGMENT_SHADER";
              }
      }`;
      if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
        throw `${shaderTypeString} shader failed to compile. ${glContext.getShaderInfoLog(shader)}.`;
      }
      return shader;
    }
    /**
     * Links shaders into a shader program.
     *
     * @static
     * @param {WebGL2RenderingContext} glContext
     * @param {WebGLShader} vertexShader
     * @param {WebGLShader} fragmentShader
     * @returns {WebGLProgram}
     */
    static linkShaders(glContext, vertexShader, fragmentShader) {
      // Make the program and link the shaders in it.
      const program = glContext.createProgram();
      glContext.attachShader(program, vertexShader);
      glContext.attachShader(program, fragmentShader);
      glContext.linkProgram(program);
      // Throw error if something is wrong.
      if (!glContext.getProgramParameter(program, glContext.LINK_STATUS)) {
        throw `Shader program failed to link. ${glContext.getProgramInfoLog(program)}`;
      }
      // Delete the shaders to free memory.
      glContext.deleteShader(vertexShader);
      glContext.deleteShader(fragmentShader);
      return program;
    }
    /**
     * Creates an instance of Shader.
     *
     * @constructor
     * @param {WebGL2RenderingContext} gl
     * @param {string} vertexShaderCode
     * @param {string} fragmentShaderCode
     */
    constructor(gl, vertexShaderCode, fragmentShaderCode) {
      const vertexShader = Shader.compileShader(gl, vertexShaderCode, "vertex");
      const fragmentShader = Shader.compileShader(
        gl,
        fragmentShaderCode,
        "fragment",
      );
      this.shader = Shader.linkShaders(gl, vertexShader, fragmentShader);
      this.gl = gl;
      this.uniforms = {};
      // Get all active uniforms in the program and store info and location in uniforms object.
      let activeUniforms = gl.getProgramParameter(
        this.shader,
        gl.ACTIVE_UNIFORMS,
      );
      for (let i = 0; i < activeUniforms; i++) {
        let uniform = gl.getActiveUniform(this.shader, i);
        if (uniform == null)
          throw new Error("Uniform index is invalid for some reason.");
        let location = gl.getUniformLocation(this.shader, uniform.name);
        if (location == null) continue;
        this.uniforms[uniform.name] = {
          size: uniform.size,
          type: uniform.type,
          location,
        };
      }
      // Pre-cache uniform types to their corresponding uniform setter functions.
      this.GLENUM_TO_SETTER = {
        [gl.FLOAT]: (location, value) => gl.uniform1f(location, value),
        [gl.INT]: (location, value) => gl.uniform1i(location, value),
        [gl.UNSIGNED_INT]: (location, value) => gl.uniform1ui(location, value),
        [gl.BOOL]: (location, value) => gl.uniform1i(location, value),
        [gl.FLOAT_VEC2]: (location, value) => gl.uniform2fv(location, value),
        [gl.FLOAT_VEC3]: (location, value) => gl.uniform3fv(location, value),
        [gl.FLOAT_VEC4]: (location, value) => gl.uniform4fv(location, value),
        [gl.INT_VEC2]: (location, value) => gl.uniform2iv(location, value),
        [gl.INT_VEC3]: (location, value) => gl.uniform3iv(location, value),
        [gl.INT_VEC4]: (location, value) => gl.uniform4iv(location, value),
        [gl.UNSIGNED_INT_VEC2]: (location, value) =>
          gl.uniform2uiv(location, value),
        [gl.UNSIGNED_INT_VEC3]: (location, value) =>
          gl.uniform3uiv(location, value),
        [gl.UNSIGNED_INT_VEC4]: (location, value) =>
          gl.uniform4uiv(location, value),
        [gl.BOOL_VEC2]: (location, value) => gl.uniform2iv(location, value),
        [gl.BOOL_VEC3]: (location, value) => gl.uniform3iv(location, value),
        [gl.BOOL_VEC4]: (location, value) => gl.uniform4iv(location, value),
        [gl.FLOAT_MAT2]: (location, value) =>
          gl.uniformMatrix2fv(location, false, value),
        [gl.FLOAT_MAT3]: (location, value) =>
          gl.uniformMatrix3fv(location, false, value),
        [gl.FLOAT_MAT4]: (location, value) =>
          gl.uniformMatrix4fv(location, false, value),
        [gl.FLOAT_MAT2x3]: (location, value) =>
          gl.uniformMatrix2x3fv(location, false, value),
        [gl.FLOAT_MAT2x4]: (location, value) =>
          gl.uniformMatrix2x4fv(location, false, value),
        [gl.FLOAT_MAT3x2]: (location, value) =>
          gl.uniformMatrix3x2fv(location, false, value),
        [gl.FLOAT_MAT3x4]: (location, value) =>
          gl.uniformMatrix3x4fv(location, false, value),
        [gl.FLOAT_MAT4x2]: (location, value) =>
          gl.uniformMatrix4x2fv(location, false, value),
        [gl.FLOAT_MAT4x3]: (location, value) =>
          gl.uniformMatrix4x3fv(location, false, value),
        [gl.SAMPLER_2D]: (location, value) => gl.uniform1i(location, value),
      };
    }
    /** Use this shader program */
    use() {
      this.gl.useProgram(this.shader);
    }
    /**
     * Set uniform
     *
     * @param {string} name Name of the uniform in program. Must be an active uniform.
     * @param {*} value Value to set the uniform to.
     */
    setUniform(name, value) {
      this.GLENUM_TO_SETTER[this.uniforms[name].type](
        this.uniforms[name].location,
        value,
      );
    }
  }
  // Basic vertex shader
  const basicVS = /*glsl*/ `#version 300 es
      // Set the attribute locations beforehand.
      layout (location = 0) in vec3 position;
      layout (location = 1) in vec3 normal;
      layout (location = 2) in vec2 texcoord_0;
      layout (location = 3) in vec4 tangent;

      uniform mat4 viewProjection;
      uniform mat4 model;

      // Normal matrix is used for handling normal transforms
      uniform mat3 normalMatrix;

      out vec2 v_texcoord_0;
      out vec3 v_normal;
      out vec3 v_fragPos;
      out vec3 v_tangent;
      out float v_tangent_sign;

      void main() {
          gl_Position = viewProjection * model * vec4(position, 1.0f);
          v_normal = normalize(normalMatrix * normal);
          v_texcoord_0 = texcoord_0;
          v_fragPos = vec3(model * vec4(position, 1.0f));
          v_tangent = normalize(normalMatrix * tangent.xyz);
          v_tangent_sign = tangent.w;
      }
  `;
  // Point light fragment shader, used for lights because lights remain a constant color.
  const pointLightFS = /*glsl*/ `#version 300 es
      precision highp float;

      in vec2 v_texcoord_0;
      out vec4 fragmentColor;

      uniform vec3 emissiveFactor;
      uniform bool isTexture;
      uniform sampler2D textureMap;

      void main() {
          // Simply output the color of the light.
          if (isTexture) {
              fragmentColor = vec4(texture(textureMap, v_texcoord_0).rgb, 1.0);
          } else {
              fragmentColor = vec4(emissiveFactor, 1.0);
          }
      }
  `;
  // Phong shader, used for non-light objects.
  const phongFS = /*glsl*/ `#version 300 es
      precision highp float;

      in vec2 v_texcoord_0;
      in vec3 v_normal;
      in vec3 v_fragPos;
      in vec3 v_tangent;
      in float v_tangent_sign;

      out vec4 fragmentColor;

      // Camera position
      uniform vec3 viewPos;

      // Material data in PBR form (supplied by GLTF)
      struct PBR_Material {
      vec4 albedo;
      float metalness;
      sampler2D albedoMap;
      sampler2D MRmap;
      float roughness;

      bool isTexture;
      bool isMRt;
      };
      uniform PBR_Material pbr_material;

      // Material data in Phong form (used for conversion)
      struct Material {
      vec3 ambient;
      vec3 diffuse;
      vec3 specular;
      float shininess;
      };

      // Directional light
      struct DirLight {
      vec3 direction;
      vec3 ambient;
      vec3 diffuse;
      vec3 specular;
      };
      uniform DirLight dirLight;

      // Point lights
      struct PointLight {
      vec3 position;

      vec3 ambient;
      vec3 diffuse;
      vec3 specular;

      float constant;
      float linear;
      float quadratic;
      };

      uniform PointLight pointLights[${MAX_POINT_LIGHTS}];
      uniform uint numPointLights;

      // Spot lights
      struct SpotLight {
      vec3 position;
      vec3 direction;
      float cutOff;
      float outerCufOff;

      vec3 ambient;
      vec3 diffuse;
      vec3 specular;

      float constant;
      float linear;
      float quadratic;
      };
      uniform SpotLight spotLights[${MAX_SPOT_LIGHTS}];
      uniform uint numSpotLights;

      // Shader lighting calculations all use Phong lighting.
      // Ambient light is the "base" amount or "default" lighting.
      // Diffuse light depends on the angle between the light and the normal vector of that fragment
      // Specular light factors in shininess and how close the reflected angle of the light is to the viewer's angle

      vec3 CalcDirLight(DirLight light, Material material, vec3 normal, vec3 viewDir) {
      vec3 lightDir = normalize(-light.direction);
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);

      vec3 ambient = light.ambient * material.ambient;
      vec3 diffuse = light.diffuse * diff * material.diffuse;
      vec3 specular = light.specular * spec * material.specular;

      return (ambient + diffuse + specular);
      }

      vec3 CalcPointLight(PointLight light, Material material, vec3 normal, vec3 fragPos, vec3 viewDir) {
      vec3 lightDir = normalize(light.position - fragPos);
      
      float diff = max(dot(normal, lightDir), 0.0);

      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);

      float distance = length(light.position - fragPos);
      float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));

      vec3 ambient = light.ambient * material.ambient;
      vec3 diffuse = light.diffuse * diff * material.diffuse;
      vec3 specular = light.specular * spec * material.specular;

      ambient *= attenuation;
      diffuse *= attenuation;
      specular *= attenuation;

      return (ambient + diffuse + specular);
      }

      vec3 CalcSpotLight(SpotLight light, Material material, vec3 normal, vec3 fragPos, vec3 viewDir) {
      vec3 lightDir = normalize(light.position - fragPos);
      float theta = dot(lightDir, normalize(-light.direction));
      float epsilon = light.cutOff - light.outerCufOff;
      float intensity = clamp((theta - light.outerCufOff) / epsilon, 0.0, 1.0);

      float diff = max(dot(normal, lightDir), 0.0);

      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);

      float distance = length(light.position - fragPos);
      float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));

      vec3 ambient = light.ambient * material.ambient;
      vec3 diffuse = light.diffuse * diff * material.diffuse;
      vec3 specular = light.specular * spec * material.specular;

      ambient *= attenuation * intensity;
      diffuse *= attenuation * intensity;
      specular *= attenuation * intensity;

      return (ambient + diffuse + specular);
      }

      uniform bool isNormalMap;
      uniform sampler2D normalMap;

      uniform bool isEmissiveMap;
      uniform sampler2D emissiveMap;
      uniform vec3 emissiveFactor;
      uniform float emissiveStrength;

      void main() {
      Material material;

      float metalness;
      float roughness;

      if (pbr_material.isMRt) {
        roughness = texture(pbr_material.MRmap, v_texcoord_0).g;
        metalness = texture(pbr_material.MRmap, v_texcoord_0).b;
      } else {
        roughness = pbr_material.roughness;
        metalness = pbr_material.metalness;
      }

      // Because glb gives PBR materials by default, I need to convert to glb. I used AI to help me figure out how to convert PBR to Phong.
      if (pbr_material.isTexture) {
          vec4 texColor = texture(pbr_material.albedoMap, v_texcoord_0);
          if (texColor.a < 0.1) {
              discard;
          }

          material.diffuse = texture(pbr_material.albedoMap, v_texcoord_0).rgb * (1.0 - metalness);
          material.specular = mix(vec3(0.04), texture(pbr_material.albedoMap, v_texcoord_0).rgb, metalness);
      } else {
          material.diffuse = pbr_material.albedo.rgb * (1.0 - metalness);
          material.specular = mix(vec3(0.04), pbr_material.albedo.rgb, metalness);
      }
      material.shininess = pow(2.0, 10.0 * (1.0 - roughness));
      material.ambient = material.diffuse * 0.1;

      // Normalize the normal vector and view direction.
      vec3 norm = v_normal;

      if (isNormalMap) {
        vec3 N = v_normal;
        vec3 T = v_tangent;
        vec3 B = normalize(v_tangent_sign * cross(N, T));

        mat3 TBN = mat3(T, B, N);

        vec3 normalTex = texture(normalMap, v_texcoord_0).xyz * 2.0 - 1.0;
        vec3 worldNormal = normalize(TBN * normalTex);
        norm = worldNormal;
      }

      vec3 viewDir = normalize(viewPos - v_fragPos);
      
      // Total light equals the sums of all the lights.
      vec3 result = CalcDirLight(dirLight, material, norm, viewDir);

      for (uint i = 0u; i < numPointLights; i++) {
          result += CalcPointLight(pointLights[i], material, norm, v_fragPos, viewDir);
      }
      for (uint i = 0u; i < numSpotLights; i++) {
          result += CalcSpotLight(spotLights[i], material, norm, v_fragPos, viewDir);
      }

      if (isEmissiveMap) {
        result += texture(emissiveMap, v_texcoord_0).rgb * emissiveFactor * emissiveStrength;
      } else {
        result += emissiveFactor;
      }

      // No transparents allowed yet.
      fragmentColor = vec4(result, 1.0);
      }
  `;
  /**
   * Renderer class, puts everything together.
   *
   * @class Renderer
   * @typedef {Renderer}
   */
  class Renderer {
    /**
     * Creates an instance of Renderer.
     *
     * @constructor
     * @param {string} canvasId Id of the canvas element
     */
    constructor(canvasId) {
      // Get the canvas
      const canvas = document.getElementById(canvasId);
      if (canvas == null) throw new Error("Canvas id is not valid");
      // Get the WebGL context
      const gl = canvas.getContext("webgl2");
      if (gl == null)
        throw new Error("WebGL2 is not supported by your browser or device.");
      this.gl = gl;
      this.gl.enable(this.gl.DEPTH_TEST);

      // Get asset manager and scene
      this.assetManager = new AssetManager(this.gl);
      this.scene = new Scene(this.assetManager);
      // Compile shader programs
      this.shader = {
        phong: new Shader(this.gl, basicVS, phongFS),
        light: new Shader(this.gl, basicVS, pointLightFS),
      };
      // Set directional light defaults
      this.directionalLight = {
        direction: glMatrix.vec3.fromValues(0.3, -0.5, -0.8),
        ambient: glMatrix.vec3.fromValues(0.3, 0.3, 0.3),
        diffuse: glMatrix.vec3.fromValues(1.0, 1.0, 1.0),
        specular: glMatrix.vec3.fromValues(0.5, 0.5, 0.5),
      };
    }
    /** Utility function used for changing internal canvas sizes when canvas dimensions are changed. */
    resizeCanvas() {
      const canvas = this.gl.canvas;
      if (
        canvas.width != canvas.clientWidth ||
        canvas.height != canvas.clientHeight
      ) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }

    /**
     * Gets list of primitives, frustum culls non-visible primitives, and sorts them into categories for more efficient rendering.
     *
     * @returns {{ opaque: { solid: {}; texture: {}; }; light: { pointLight: {}; spotLight: {}; }; }}
     */
    cullAndSortPrimitives(flatList) {
      const sortedLists = {
        opaque: {
          solid: [],
          texture: {},
        },
        blend: {
          solid: [],
          texture: {},
        },
        light: {
          pointLight: [],
          spotLight: [],
        },
      };
      // BEGIN AI CODE - Frustum definition (I started translating C++ to JS, then realized that AI is good at this kind of stuff so used it to complete translation and verify.) I don't fully understand the math behind this code, but it essentially splits the frustum into planes.
      // Describe a frustum
      const frustum = {
        topFace: {
          normal: glMatrix.vec3.fromValues(0, 1, 0),
          point: glMatrix.vec3.fromValues(0, 0, 0),
        },
        bottomFace: {
          normal: glMatrix.vec3.fromValues(0, 1, 0),
          point: glMatrix.vec3.fromValues(0, 0, 0),
        },
        rightFace: {
          normal: glMatrix.vec3.fromValues(0, 1, 0),
          point: glMatrix.vec3.fromValues(0, 0, 0),
        },
        leftFace: {
          normal: glMatrix.vec3.fromValues(0, 1, 0),
          point: glMatrix.vec3.fromValues(0, 0, 0),
        },
        farFace: {
          normal: glMatrix.vec3.fromValues(0, 1, 0),
          point: glMatrix.vec3.fromValues(0, 0, 0),
        },
        nearFace: {
          normal: glMatrix.vec3.fromValues(0, 1, 0),
          point: glMatrix.vec3.fromValues(0, 0, 0),
        },
      };
      let cam = this.scene.camera;
      let aspect = this.gl.canvas.width / this.gl.canvas.height;
      const halfVSide = cam.far * Math.tan(cam.fovy * 0.5);
      const halfHSide = halfVSide * aspect;
      const frontMultFar = glMatrix.vec3.create();
      glMatrix.vec3.scale(frontMultFar, cam.transform.getForward(), cam.far);
      // Near face
      glMatrix.vec3.scale(
        frustum.nearFace.point,
        cam.transform.getForward(),
        cam.near,
      );
      glMatrix.vec3.add(
        frustum.nearFace.point,
        frustum.nearFace.point,
        cam.transform.translation,
      );
      glMatrix.vec3.copy(frustum.nearFace.normal, cam.transform.getForward());
      // Far face
      glMatrix.vec3.add(
        frustum.farFace.point,
        cam.transform.translation,
        frontMultFar,
      );
      glMatrix.vec3.copy(frustum.farFace.normal, cam.transform.getForward());
      glMatrix.vec3.scale(frustum.farFace.normal, frustum.farFace.normal, -1);
      // Right face
      glMatrix.vec3.copy(frustum.rightFace.point, cam.transform.translation);
      const tempRight = glMatrix.vec3.create();
      glMatrix.vec3.scale(tempRight, cam.transform.getRight(), halfHSide);
      glMatrix.vec3.sub(frustum.rightFace.normal, frontMultFar, tempRight);
      glMatrix.vec3.cross(
        frustum.rightFace.normal,
        frustum.rightFace.normal,
        cam.transform.getUp(),
      );
      // Left face
      glMatrix.vec3.copy(frustum.leftFace.point, cam.transform.translation);
      const tempLeft = glMatrix.vec3.create();
      glMatrix.vec3.scale(tempLeft, cam.transform.getRight(), halfHSide);
      glMatrix.vec3.add(frustum.leftFace.normal, frontMultFar, tempLeft);
      glMatrix.vec3.cross(
        frustum.leftFace.normal,
        cam.transform.getUp(),
        frustum.leftFace.normal,
      );
      // Top face
      glMatrix.vec3.copy(frustum.topFace.point, cam.transform.translation);
      const tempTop = glMatrix.vec3.create();
      glMatrix.vec3.scale(tempTop, cam.transform.getUp(), halfVSide);
      glMatrix.vec3.sub(frustum.topFace.normal, frontMultFar, tempTop);
      glMatrix.vec3.cross(
        frustum.topFace.normal,
        cam.transform.getRight(),
        frustum.topFace.normal,
      );
      // Bottom face
      glMatrix.vec3.copy(frustum.bottomFace.point, cam.transform.translation);
      const tempBottom = glMatrix.vec3.create();
      glMatrix.vec3.scale(tempBottom, cam.transform.getUp(), halfVSide);
      glMatrix.vec3.add(frustum.bottomFace.normal, frontMultFar, tempBottom);
      glMatrix.vec3.cross(
        frustum.bottomFace.normal,
        frustum.bottomFace.normal,
        cam.transform.getRight(),
      );
      glMatrix.vec3.normalize(frustum.nearFace.normal, frustum.nearFace.normal);
      glMatrix.vec3.normalize(frustum.farFace.normal, frustum.farFace.normal);
      glMatrix.vec3.normalize(
        frustum.rightFace.normal,
        frustum.rightFace.normal,
      );
      glMatrix.vec3.normalize(frustum.leftFace.normal, frustum.leftFace.normal);
      glMatrix.vec3.normalize(frustum.topFace.normal, frustum.topFace.normal);
      glMatrix.vec3.normalize(
        frustum.bottomFace.normal,
        frustum.bottomFace.normal,
      );
      // END AI CODE
      // This function calculates how far a point is in front of the plane.
      function getSignedDistanceToPlane(face, center) {
        return (
          glMatrix.vec3.dot(face.normal, center) -
          glMatrix.vec3.dot(face.normal, face.point)
        );
      }
      // This function checks if a sphere is on or in front of the plane.
      function isOnOrForwardPlane(face, center, radius) {
        return getSignedDistanceToPlane(face, center) > -radius;
      }
      // This function checks that a sphere is in a frustrum.
      function checkAllPlanes(center, radius) {
        return (
          isOnOrForwardPlane(frustum.leftFace, center, radius) &&
          isOnOrForwardPlane(frustum.rightFace, center, radius) &&
          isOnOrForwardPlane(frustum.farFace, center, radius) &&
          isOnOrForwardPlane(frustum.nearFace, center, radius) &&
          isOnOrForwardPlane(frustum.topFace, center, radius) &&
          isOnOrForwardPlane(frustum.bottomFace, center, radius)
        );
      }
      // Used for bounding sphere calculations
      const ds = glMatrix.vec3.create();
      const center = glMatrix.vec3.create();
      let radius = 0;
      // Some meshes have emissive factors set to zero. Use this variable to check for those.
      let noEmissiveFactor = JSON.stringify([0, 0, 0]);
      // Now sort the components
      for (const component of flatList) {
        const mesh = this.assetManager.meshes[component.mesh];

        // That is, get the primitives and sort them.
        for (const primitive of mesh.primitives) {
          const material = this.assetManager.getMaterial(
            primitive.material.folder,
            primitive.material.index,
          );

          // If not a light, check if can be frustum culled. (Lights must be in the scene even if not visible because they can influence visible objects' lighting.)
          if (component.light == null) {
            /// BEGIN AI CODE - I was struggling with some bugs here and AI helped me get it correct.
            // Calculate center of the object in local coordinate space
            glMatrix.vec3.add(center, primitive.vMin, primitive.vMax);
            glMatrix.vec3.scale(center, center, 0.5);
            // Transform that center to world space using the transformation matrix of the component
            glMatrix.vec3.transformMat4(center, center, component.worldMatrix);
            // Take a cross-diagonal of the AABB box, make half of that the radius, and multiply it by the largest scale to get a guarenteed complete bounding sphere.
            glMatrix.vec3.sub(ds, primitive.vMax, primitive.vMin);

            let componentScale = glMatrix.vec3.create();
            glMatrix.mat4.getScaling(componentScale, component.worldMatrix);

            const maxScale = Math.max(
              componentScale[0],
              componentScale[1],
              componentScale[2],
            );
            radius = (glMatrix.vec3.len(ds) / 2) * maxScale;
            /// END AI CODE
            // Not in the frustum? Don't bother sorting it.
            if (!checkAllPlanes(center, radius)) {
              continue;
            }
          }
          // Give the primitive necessary info for drawing.
          const primitiveInstance = {
            ...primitive,
            transform: component.worldMatrix,
            normalMatrix: component.normalMatrix,
            light: component.light,
          };
          // Get the material

          // Sort by material
          if (primitiveInstance.light != null) {
            // This is a light
            if ("emissiveTexture" in material) {
              // This is a lighted texture
              let folder = primitive.material.folder;
              let index = material.emissiveTexture.index;

              primitiveInstance.lightTexture = {
                folder,
                index,
                lightType: primitiveInstance.light.lightType,
              };
            }

            if (primitiveInstance.light.lightType == "point") {
              sortedLists.light.pointLight.push(primitiveInstance);
            } else if (primitiveInstance.light.lightType == "spot") {
              sortedLists.light.spotLight.push(primitiveInstance);
            }
          } else if (
            material.alphaMode == undefined ||
            material.alphaMode == "OPAQUE"
          ) {
            if ("baseColorTexture" in material.pbrMetallicRoughness) {
              // This is a textured material.
              // Get the image location
              let folder = primitive.material.folder;
              let textureList = sortedLists.opaque.texture;
              let index = material.pbrMetallicRoughness.baseColorTexture.index;
              // Create folder and indexes if needed.
              if (!(folder in textureList)) {
                textureList[folder] = {};
              }
              if (!(index in textureList[folder])) {
                textureList[folder][index] = [];
              }
              // Push to list of opaque textures with this unique texture.
              textureList[folder][index].push(primitiveInstance);
            } else {
              // This is a normal solid color object.
              sortedLists.opaque.solid.push(primitiveInstance);
            }

            if ("emissiveFactor" in material) {
              primitiveInstance.emissiveFactor =
                component.renderComponent.emissive.color ||
                material.emissiveFactor;
              primitiveInstance.emissiveStrength =
                component.renderComponent.emissive.strength || 1;
            }
            if ("emissiveTexture" in material) {
              let folder = primitive.material.folder;
              let index = material.emissiveTexture.index;

              primitiveInstance.emissiveTexture = { folder, index };
            }
          } else if (material.alphaMode == "BLEND") {
            if ("baseColorTexture" in material.pbrMetallicRoughness) {
              // This is a textured material.
              // Get the image location
              let folder = primitive.material.folder;
              let textureList = sortedLists.blend.texture;
              let index = material.pbrMetallicRoughness.baseColorTexture.index;
              // Create folder and indexes if needed.
              if (!(folder in textureList)) {
                textureList[folder] = {};
              }
              if (!(index in textureList[folder])) {
                textureList[folder][index] = [];
              }
              // Push to list of opaque textures with this unique texture.
              textureList[folder][index].push(primitiveInstance);
            } else {
              // This is a normal solid color object.
              sortedLists.blend.solid.push(primitiveInstance);
            }

            if ("emissiveFactor" in material) {
              primitiveInstance.emissiveFactor = material.emissiveFactor;
            }
            if ("emissiveTexture" in material) {
              let folder = primitive.material.folder;
              let index = material.emissiveTexture.index;

              primitiveInstance.emissiveTexture = { folder, index };
            }
          }
        }
      }
      /*
      // At the end of cullAndSortPrimitives, right before return sortedLists
      console.log("=== SORTED LISTS ===");
      console.log("Opaque Solid:", sortedLists.opaque.solid.length);
      console.log(
        "Opaque Texture folders:",
        Object.keys(sortedLists.opaque.texture),
      );
      for (const folder in sortedLists.opaque.texture) {
        for (const index in sortedLists.opaque.texture[folder]) {
          console.log(
            `  ${folder}[${index}]:`,
            sortedLists.opaque.texture[folder][index].length,
            "primitives",
          );
        }
      }
      console.log("Point Lights:", sortedLists.light.pointLight.length);
      console.log("Spot Lights:", sortedLists.light.spotLight.length);

      // Log details of each category
      console.log("\n=== TEXTURED PRIMITIVES ===");
      for (const folder in sortedLists.opaque.texture) {
        for (const index in sortedLists.opaque.texture[folder]) {
          for (const prim of sortedLists.opaque.texture[folder][index]) {
            const mat = this.assetManager.getMaterial(
              prim.material.folder,
              prim.material.index,
            );
            console.log("Texture primitive:", {
              folder,
              index,
              hasBaseColor: "baseColorTexture" in mat.pbrMetallicRoughness,
              hasNormal: "normalTexture" in mat,
              hasMR: "metallicRoughnessTexture" in mat.pbrMetallicRoughness,
              emissive: mat.emissiveFactor,
            });
          }
        }
      }

      console.log("\n=== LIGHTS ===");
      for (const light of sortedLists.light.pointLight) {
        const mat = this.assetManager.getMaterial(
          light.material.folder,
          light.material.index,
        );
        console.log("Point light:", {
          emissive: mat.emissiveFactor,
          baseColor: mat.pbrMetallicRoughness?.baseColorFactor,
          hasTexture: "lightTexture" in light,
        });
      }

      return sortedLists;
      */
      return sortedLists;
    }

    flattenNode(node) {
      let list = [];
      if ("children" in node) {
        for (const child of node.children) {
          list.push(...this.flattenNode(child));
        }
      }
      if (node.renderComponent.mesh) {
        let normalMatrix = glMatrix.mat3.create();
        let utilMatrix = glMatrix.mat4.create();

        // Invert the matrix, transpose it, and take the upper 3x3 to get the normal matrix.
        glMatrix.mat4.invert(utilMatrix, node.worldMatrix);
        glMatrix.mat4.transpose(utilMatrix, utilMatrix);
        glMatrix.mat3.fromMat4(normalMatrix, utilMatrix);

        node.normalMatrix = normalMatrix;
        node.mesh = node.renderComponent.mesh;
        node.light = node.renderComponent.light;

        list.push(node);
      }

      return list;
    }
    flattenSceneList(list) {
      let flatList = [];
      for (const child of list) {
        flatList.push(...this.flattenNode(child));
      }
      return flatList;
    }

    /** Render the scene! */
    render() {
      this.resizeCanvas();

      this.scene.updateNodesTree();
      let flatList = this.flattenSceneList(this.scene.componentList);

      // Get a list.
      const primitiveList = this.cullAndSortPrimitives(flatList);
      // Clear the canvas
      this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      // Get the projection matrix.
      const projection = glMatrix.mat4.create();
      glMatrix.mat4.perspective(
        projection,
        this.scene.camera.fovy,
        this.gl.canvas.width / this.gl.canvas.height,
        this.scene.camera.near,
        this.scene.camera.far,
      );
      // Create the view projection matrix.
      const viewProjection = glMatrix.mat4.create();
      glMatrix.mat4.multiply(
        viewProjection,
        projection,
        this.scene.camera.getViewMatrix(),
      );
      // Set the phong shader
      let shader = this.shader["phong"];
      shader.use();
      // Set directional lighting
      shader.setUniform("dirLight.direction", this.directionalLight.direction);
      shader.setUniform("dirLight.ambient", this.directionalLight.ambient);
      shader.setUniform("dirLight.diffuse", this.directionalLight.diffuse);
      shader.setUniform("dirLight.specular", this.directionalLight.specular);
      // Set view projection and view position
      shader.setUniform("viewProjection", viewProjection);
      shader.setUniform("viewPos", this.scene.camera.transform.translation);

      this.gl.enable(this.gl.CULL_FACE);

      // Set number of point lights.
      if (primitiveList.light.pointLight.length > MAX_POINT_LIGHTS)
        throw new Error("Too many point lights!");
      shader.setUniform(
        "numPointLights",
        primitiveList.light.pointLight.length,
      );
      // Loop through the point light array in the shader and set their uniforms.
      for (const lightIndex in primitiveList.light.pointLight) {
        const light = primitiveList.light.pointLight[lightIndex];
        const material = this.assetManager.getMaterial(
          light.material.folder,
          light.material.index,
        );
        shader.setUniform(`pointLights[${lightIndex}].ambient`, [
          material?.emissiveFactor[0] * 0.1,
          material?.emissiveFactor[1] * 0.1,
          material?.emissiveFactor[2] * 0.1,
        ]);
        shader.setUniform(
          `pointLights[${lightIndex}].diffuse`,
          material?.emissiveFactor,
        );
        shader.setUniform(
          `pointLights[${lightIndex}].specular`,
          material?.emissiveFactor,
        );
        shader.setUniform(`pointLights[${lightIndex}].constant`, 1);
        shader.setUniform(
          `pointLights[${lightIndex}].linear`,
          4.5 / light.light?.lightRange,
        );
        shader.setUniform(
          `pointLights[${lightIndex}].quadratic`,
          75 / (light.light?.lightRange * light.light?.lightRange),
        );
        let translation = glMatrix.vec3.create();
        glMatrix.mat4.getTranslation(translation, light.transform);
        shader.setUniform(`pointLights[${lightIndex}].position`, translation);
      }
      // Set number of spot lights.
      if (primitiveList.light.spotLight.length > MAX_SPOT_LIGHTS)
        throw new Error("Too many point lights!");
      shader.setUniform("numSpotLights", primitiveList.light.spotLight.length);
      // Loop through the spot light array in the shader and set uniforms.
      for (const lightIndex in primitiveList.light.spotLight) {
        const light = primitiveList.light.spotLight[lightIndex];
        const material = this.assetManager.getMaterial(
          light.material.folder,
          light.material.index,
        );
        shader.setUniform(`spotLights[${lightIndex}].ambient`, [
          material?.emissiveFactor[0] * 0.1,
          material?.emissiveFactor[1] * 0.1,
          material?.emissiveFactor[2] * 0.1,
        ]);
        shader.setUniform(
          `spotLights[${lightIndex}].diffuse`,
          material?.emissiveFactor,
        );
        shader.setUniform(
          `spotLights[${lightIndex}].specular`,
          material?.emissiveFactor,
        );
        shader.setUniform(`spotLights[${lightIndex}].constant`, 1);
        shader.setUniform(
          `spotLights[${lightIndex}].linear`,
          4.5 / light.light?.lightRange,
        );
        shader.setUniform(
          `spotLights[${lightIndex}].quadratic`,
          75 / (light.light?.lightRange * light.light?.lightRange),
        );
        let translation = glMatrix.vec3.create();
        glMatrix.mat4.getTranslation(translation, light.transform);
        shader.setUniform(`spotLights[${lightIndex}].position`, translation);
        shader.setUniform(
          `spotLights[${lightIndex}].direction`,
          light.light?.direction,
        );
        shader.setUniform(
          `spotLights[${lightIndex}].cutOff`,
          light.light?.cutOff,
        );
        shader.setUniform(
          `spotLights[${lightIndex}].outerCufOff`,
          light.light?.outerCutOff,
        );
      }

      let lastBoundEmissive = null;

      // Solid colored primitives
      shader.setUniform("pbr_material.isTexture", false);
      shader.setUniform("pbr_material.isMRt", false);
      shader.setUniform("isNormalMap", false);
      const solids = primitiveList.opaque.solid;
      for (const primitive of solids) {
        shader.setUniform("model", primitive.transform);
        shader.setUniform("normalMatrix", primitive.normalMatrix);
        const material = this.assetManager.getMaterial(
          primitive.material.folder,
          primitive.material.index,
        );
        shader.setUniform(
          "pbr_material.albedo",
          material?.pbrMetallicRoughness.baseColorFactor,
        );
        shader.setUniform(
          "pbr_material.metalness",
          material?.pbrMetallicRoughness.metallicFactor ?? 0,
        );
        shader.setUniform(
          "pbr_material.roughness",
          material?.pbrMetallicRoughness.roughnessFactor ?? 0,
        );

        if ("emissiveFactor" in material) {
          shader.setUniform("emissiveFactor", primitive.emissiveFactor);
          shader.setUniform("emissiveStrength", primitive.emissiveStrength);

          if ("emissiveTexture" in material) {
            let emissiveTexLoc = this.assetManager.getTexture(
              folder,
              Number(material.emissiveTexture.index),
            );
            if (emissiveTexLoc != lastBoundEmissive) {
              shader.setUniform("isEmissiveMap", true);
              this.gl.activeTexture(this.gl.TEXTURE3);
              this.gl.bindTexture(this.gl.TEXTURE_2D, emissiveTexLoc);
              shader.setUniform("emissiveMap", 3);
              lastBoundEmissive = emissiveTexLoc;
            } else {
              shader.setUniform("isEmissiveMap", false);
            }
          }
        } else {
          shader.setUniform("emissiveFactor", [0, 0, 0]);
          shader.setUniform("isEmissiveMap", false);
        }

        this.gl.bindVertexArray(primitive.vao);
        this.gl.drawElements(
          primitive.mode,
          primitive.count,
          primitive.type,
          primitive.offset,
        );
        this.gl.bindVertexArray(null);
      }
      // Textured primitives
      let lastBoundAlbedo = null;
      let lastBoundNormal = null;
      let lastBoundRoughMetal = null;

      shader.setUniform("pbr_material.isTexture", true);

      const textures = primitiveList.opaque.texture;
      for (const folder in textures) {
        for (const index in textures[folder]) {
          if (
            this.assetManager.getTexture(folder, Number(index)) !=
            lastBoundAlbedo
          ) {
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(
              this.gl.TEXTURE_2D,
              this.assetManager.getTexture(folder, Number(index)),
            );
            shader.setUniform("pbr_material.albedoMap", 0);
            lastBoundAlbedo = this.assetManager.getTexture(
              folder,
              Number(index),
            );
          }

          for (const primitive of textures[folder][index]) {
            shader.setUniform("model", primitive.transform);
            shader.setUniform("normalMatrix", primitive.normalMatrix);
            const material = this.assetManager.getMaterial(
              primitive.material.folder,
              primitive.material.index,
            );

            if ("normalTexture" in material) {
              let normTexLoc = this.assetManager.getTexture(
                folder,
                Number(material.normalTexture.index),
              );
              if (normTexLoc != lastBoundNormal) {
                shader.setUniform("isNormalMap", true);
                this.gl.activeTexture(this.gl.TEXTURE2);
                this.gl.bindTexture(this.gl.TEXTURE_2D, normTexLoc);
                shader.setUniform("normalMap", 2);
                lastBoundNormal = normTexLoc;
                shader.setUniform("isNormalMap", false);
              }
            } else {
              shader.setUniform("isNormalMap", false);
            }

            if ("metallicRoughnessTexture" in material.pbrMetallicRoughness) {
              let texLoc = this.assetManager.getTexture(
                folder,
                Number(
                  material.pbrMetallicRoughness.metallicRoughnessTexture.index,
                ),
              );
              if (texLoc != lastBoundRoughMetal) {
                shader.setUniform("pbr_material.isMRt", true);
                this.gl.activeTexture(this.gl.TEXTURE1);
                this.gl.bindTexture(this.gl.TEXTURE_2D, texLoc);
                shader.setUniform("pbr_material.MRmap", 1);
                lastBoundRoughMetal = texLoc;
              }
            } else {
              shader.setUniform("pbr_material.isMRt", false);
              shader.setUniform(
                "pbr_material.metalness",
                material?.pbrMetallicRoughness.metallicFactor ?? 0,
              );
              shader.setUniform(
                "pbr_material.roughness",
                material?.pbrMetallicRoughness.roughnessFactor ?? 0,
              );
            }

            if ("emissiveFactor" in material) {
              shader.setUniform("emissiveFactor", primitive.emissiveFactor);
              shader.setUniform("emissiveStrength", primitive.emissiveStrength);

              if ("emissiveTexture" in material) {
                let emissiveTexLoc = this.assetManager.getTexture(
                  folder,
                  Number(material.emissiveTexture.index),
                );
                if (emissiveTexLoc != lastBoundEmissive) {
                  shader.setUniform("isEmissiveMap", true);
                  this.gl.activeTexture(this.gl.TEXTURE3);
                  this.gl.bindTexture(this.gl.TEXTURE_2D, emissiveTexLoc);
                  shader.setUniform("emissiveMap", 3);
                  lastBoundEmissive = emissiveTexLoc;
                } else {
                  shader.setUniform("isEmissiveMap", false);
                }
              }
            } else {
              shader.setUniform("emissiveFactor", [0, 0, 0]);
              shader.setUniform("isEmissiveMap", false);
            }

            this.gl.bindVertexArray(primitive.vao);
            this.gl.drawElements(
              primitive.mode,
              primitive.count,
              primitive.type,
              primitive.offset,
            );
            this.gl.bindVertexArray(null);
          }
        }
      }

      this.gl.disable(this.gl.CULL_FACE);
      // Textured primitives
      const texturedTransparents = primitiveList.blend.texture;
      for (const folder in texturedTransparents) {
        for (const index in texturedTransparents[folder]) {
          this.gl.activeTexture(this.gl.TEXTURE0);
          this.gl.bindTexture(
            this.gl.TEXTURE_2D,
            this.assetManager.getTexture(folder, Number(index)),
          );
          shader.setUniform("pbr_material.albedoMap", 0);

          for (const primitive of texturedTransparents[folder][index]) {
            shader.setUniform("model", primitive.transform);
            shader.setUniform("normalMatrix", primitive.normalMatrix);
            const material = this.assetManager.getMaterial(
              primitive.material.folder,
              primitive.material.index,
            );

            shader.setUniform(
              "pbr_material.metalness",
              material?.pbrMetallicRoughness.metallicFactor ?? 0,
            );
            shader.setUniform(
              "pbr_material.roughness",
              material?.pbrMetallicRoughness.roughnessFactor ?? 0,
            );
            this.gl.bindVertexArray(primitive.vao);
            this.gl.drawElements(
              primitive.mode,
              primitive.count,
              primitive.type,
              primitive.offset,
            );
            this.gl.bindVertexArray(null);
          }
        }
      }
      this.gl.enable(this.gl.CULL_FACE);

      // Lights use a different shader
      shader = this.shader["light"];
      shader.use();
      shader.setUniform("viewProjection", viewProjection);
      // Draw the lights
      for (let primitive of primitiveList.light.pointLight) {
        if ("lightTexture" in primitive) {
          shader.setUniform("isTexture", true);
          this.gl.activeTexture(this.gl.TEXTURE0);
          this.gl.bindTexture(
            this.gl.TEXTURE_2D,
            this.assetManager.getTexture(
              primitive.lightTexture.folder,
              primitive.lightTexture.index,
            ),
          );
          shader.setUniform("textureMap", 0);
        } else {
          shader.setUniform("isTexture", false);
          shader.setUniform(
            "emissiveFactor",
            this.assetManager.getMaterial(
              primitive.material.folder,
              primitive.material.index,
            )?.emissiveFactor,
          );
        }

        shader.setUniform("model", primitive.transform);

        this.gl.bindVertexArray(primitive.vao);
        this.gl.drawElements(
          primitive.mode,
          primitive.count,
          primitive.type,
          primitive.offset,
        );
        this.gl.bindVertexArray(null);
      }
      for (let primitive of primitiveList.light.spotLight) {
        shader.setUniform("model", primitive.transform);
        shader.setUniform(
          "emissiveFactor",
          this.assetManager.getMaterial(
            primitive.material.folder,
            primitive.material.index,
          )?.emissiveFactor,
        );
        this.gl.bindVertexArray(primitive.vao);
        this.gl.drawElements(
          primitive.mode,
          primitive.count,
          primitive.type,
          primitive.offset,
        );
        this.gl.bindVertexArray(null);
      }
    }
  }
  return { Renderer, RenderComponent };
})();
