import * as fontTextureAtlas from '../render/font-texture-atlas'
import { WebGL2, VarKind } from '../render/webgl-utils'
import * as cc from '../core/canvas-container'

// TODO: goodbye.
// const xleft = cellWidth * col
// const xright = xleft + cellWidth
// const ytop = cellHeight * row
// const ybottom = ytop + cellHeight

// return [
//   xleft, ytop,
//   xright, ybottom,
//   xleft, ybottom,
//   xright, ytop,
//   xright, ybottom,
//   xleft, ytop,
// ]

// position transforms
//
//
// col * cell.width
// row * cell.height
// -> absolute pixel location
//
// absPixelLoc * quadVertex[0] -> vertex position
//

const dothewebglthing = (canvasElement: HTMLCanvasElement) => {
  const { gl, canvas, resize, setupProgram, createVertexArray, addData, setupCanvasTexture } = WebGL2()
  Object.assign(canvas.style, {
    top: '100px',
    position: 'absolute',
    border: '1px solid red',
  })

  document.body.appendChild(canvas)

  const program = setupProgram({
    quadVertex: VarKind.Attribute,
    charCode: VarKind.Attribute,
    cellPosition: VarKind.Attribute,
    canvasResolution: VarKind.Uniform,
    textureResolution: VarKind.Uniform,
    globalColor: VarKind.Uniform,
    textureImage: VarKind.Uniform,
    cellSize: VarKind.Uniform,
  })

  program.setVertexShader(v => `
    in vec2 ${v.quadVertex};
    in vec2 ${v.cellPosition};
    in float ${v.charCode};
    uniform vec2 ${v.canvasResolution};
    uniform vec2 ${v.textureResolution};
    uniform vec2 ${v.cellSize};

    out vec2 o_glyphPosition;

    void main() {
      vec2 absolutePixelPosition = ${v.cellPosition} * ${v.cellSize};
      vec2 vertexPosition = absolutePixelPosition + ${v.quadVertex};
      vec2 posFloat = vertexPosition / ${v.canvasResolution};
      float posx = posFloat.x * 2.0 - 1.0;
      float posy = posFloat.y * -2.0 + 1.0;
      gl_Position = vec4(posx, posy, 0, 1);

      float charIndex = ${v.charCode} - 33.0;
      vec2 glyphPixelPosition = vec2(0, charIndex) * ${v.cellSize};
      vec2 glyphVertex = glyphPixelPosition + ${v.quadVertex};
      o_glyphPosition = glyphVertex / ${v.textureResolution};
    }
  `)

  program.setFragmentShader(v => `
    precision highp float;

    in vec2 o_glyphPosition;
    uniform vec4 ${v.globalColor};
    uniform sampler2D ${v.textureImage};

    out vec4 outColor;

    void main() {
      outColor = ${v.globalColor};
      // vec4 color = texture(${v.textureImage}, o_glyphPosition);
      // outColor = color * ${v.globalColor};
    }
  `)

  program.create()

  createVertexArray()

  // TODO: TODO TODO TODO TODO LOL TODO
  // atlas should start at 33??? 32 is invis
  // how much shit can we move to shaders for calc
  // change the arrays to not be float32
  // no alpha. maybe faster?
  // support char color thanks
  // use vertexAttribDivisor to run the vertex position attributes
  // more than once (instanced drawing with drawArraysInstanced)
  // see cheat codes here: https://stackoverflow.com/a/46068799
  // yo can we combine the arrays for position + texture into one?
  // cell background solid color rendering - do we send vertices
  // for each cell and draw them all? or try to combine in JS
  // before wrendering? we will probably have many dupes
  // actually we should check with the new UI protocol. we may
  // get them batched already.

  const { width: w, height: h } = cc.cell
  const quad = [
    0, 0,
    w, h,
    0, h,
    w, 0,
    w, h,
    0, 0,
  ]

  addData(new Float32Array(quad), {
    pointer: program.vars.quadVertex,
    type: gl.FLOAT,
    size: 2,
  })

  // our texture atlas starts with 32 which is the first usable ascii character. most before are 32 are control chars
  const charCode = (char: string): number => char.codePointAt(0) || 32

  const wrenderData = [
    // col, row, charcode
    1, 1, charCode('a'),
    // 2, 1, charCode('S'),
    3, 1, charCode('s'),
  ]

  addData(new Float32Array(wrenderData), [{
    pointer: program.vars.cellPosition,
    type: gl.FLOAT,
    size: 2,
    divisor: 1,
  }, {
    pointer: program.vars.charCode,
    type: gl.FLOAT,
    size: 1,
    offset: 2 * Float32Array.BYTES_PER_ELEMENT,
    divisor: 1,
  }])

  setupCanvasTexture(canvasElement)

  const res = {
    canvas: {
      width: cc.cell.width * 50,
      height: cc.cell.height * 3,
    },
    texture: {
      width: Math.round(canvasElement.width / 2),
      height: Math.round(canvasElement.height / 2),
    },
  }

  resize(res.canvas.width, res.canvas.height)
  program.use()
  gl.uniform4fv(program.vars.globalColor, new Float32Array([1.0, 0.86, 0.0, 1.0]))
  gl.uniform1i(program.vars.textureImage, 0)
  gl.uniform2f(program.vars.canvasResolution, res.canvas.width, res.canvas.height)
  gl.uniform2f(program.vars.textureResolution, res.texture.width, res.texture.height)
  gl.uniform2f(program.vars.cellSize, cc.cell.width, cc.cell.height)
  // gl.clearColor(0.0, 0.1, 0.1, 1.0)
  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  // gl.drawArrays(gl.TRIANGLES, 0, wrenderData.length / 3)
  gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, wrenderData.length / 3)
}

const main = () => {
  const container = document.createElement('div')

  Object.assign(container.style, {
    top: '50px',
    position: 'absolute',
  })

  const { element } = fontTextureAtlas.generateStandardSet()
  element.style.border = '1px solid yellow'
  container.appendChild(element)

  document.body.appendChild(container)
  dothewebglthing(element)
}

type FUCKTYPESCRIPT = any
(document as FUCKTYPESCRIPT).fonts.onloadingdone = main
