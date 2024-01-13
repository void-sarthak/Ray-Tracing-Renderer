////////////////////////////////////////////////////////////////////////
// A WebGL program to show texture mapping on a sphere..

var gl;
var canvas;
var matrixStack = [];

var aPositionLocation;

var uCanvasWidthLocation;
var uCanvasHeightLocation;
var uCameraPositionLocation;

var uLightPositionLocation;
var uLightIntensityLocation;

var uShadowLocation;
var uReflectionLocation;

var shaderProgram;

var cameraPosition = [0.0, 0.0, 3.0];
var lightPosition = [0.0, 2.0, 4.0];
var lightIntensity = 0.9;

var isShadow = 1.0;
var isReflection = 1.0;

var bounceLimit = 1;
var uBounceLocation;

var lightSlider;
var bounceSlider;

const vertexShaderCode = `#version 300 es
in vec3 a_position;

void main()
{
  gl_Position = vec4(a_position, 1.0);
}`;

const fragShaderCode = `#version 300 es
precision mediump float;

struct Sphere
{
  vec3 center;
  float radius;
  vec3 color;
  float shine;
};

struct Ray
{
  vec3 origin;
  vec3 direction;
};

uniform float canvasWidth;
uniform float canvasHeight;
uniform vec3 cameraPosition;

uniform vec3 lightPosition;
uniform float lightIntensity;

uniform float isShadow;
uniform float isReflection;

uniform int bounceLimit;
float bias = 0.0001;

out vec4 fragColor;

float intersectSphere(Ray ray, Sphere sphere)
{
  vec3 oc = ray.origin - sphere.center;
  float a = dot(ray.direction, ray.direction);
  float b = 2.0 * dot(oc, ray.direction);
  float c = dot(oc, oc) - sphere.radius * sphere.radius;

  float discriminat = b * b - 4.0 * a * c;

  if(discriminat < 0.0)
    return -1.0;
  else
  {
    float t = (-b - sqrt(discriminat)) / (2.0 * a);
    return t;
  }
}

vec4 phongColor(Sphere sphere, float t, Ray ray)
{
  vec3 coords = ray.origin + t * ray.direction;

  vec3 n = normalize(coords - sphere.center);

  vec3 specularLight = vec3(1.0, 1.0, 1.0);

  vec3 L = normalize(lightPosition - coords);
  vec3 E = normalize(cameraPosition - coords);
  vec3 R = normalize(-reflect(L, n));

  vec3 Iamb = sphere.color * lightIntensity * 0.3;
  vec3 Idiff = sphere.color * lightIntensity * max(dot(n, L), 0.0);
  vec3 Ispec = specularLight * lightIntensity * pow(max(dot(R, E), 0.0), sphere.shine);

  vec4 color = vec4(Iamb + Idiff + Ispec, 1.0);
  return color;
}

vec4 reflectColor(Sphere sphere[4], float t, Ray ray, int index)
{
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  for(int i = 0; i < bounceLimit; i++)
  {
    vec3 coords = ray.origin + t * ray.direction;
    vec3 n = normalize(coords - sphere[index].center);
    vec3 R = normalize(reflect(ray.direction, n));

    Ray reflectRay;
    reflectRay.origin = coords;
    reflectRay.direction = R;

    float tmin = 100000.0;
    int newIndex;

    for(int i = 0; i < sphere.length(); i++)
    {
      float tnew = intersectSphere(reflectRay, sphere[i]);
      if(tnew >= 0.0 && tnew < tmin)
      {
        tmin = tnew;
        newIndex = i;
      }
    }

    if(tmin < 100000.0)
    {
      t = tmin;
      index = newIndex;
      ray = reflectRay;

      color = phongColor(sphere[index], t, ray) * 0.5;
    }
    else break;
  } 

  return color;
}

float shadowColor(Sphere sphere[4], float t, Ray ray, int index)
{
  vec3 coords = ray.origin + t * ray.direction;

  vec3 n = normalize(coords - sphere[index].center);

  vec3 L = normalize(lightPosition - coords);

  Ray shadowRay;

  shadowRay.origin = coords;
  shadowRay.direction = L;

  for(int i = 0; i < sphere.length(); i++)
  {
    float t = intersectSphere(shadowRay, sphere[i]);
    if(t >= 0.0)
    {
      return 1.0;
    }
  }
}

void main()
{
  vec4 currColor;

  Sphere sphere[4];
  
  sphere[0].center = vec3(0.0, 0.5, 0.0); 
  sphere[0].radius = 1.0;
  sphere[0].color = vec3(0.8, 0.1, 0.2);
  sphere[0].shine = 32.0;

  sphere[1].center = vec3(1.5, 1.5, 0.5);
  sphere[1].radius = 0.5;
  sphere[1].color = vec3(0.1, 0.8, 0.2);
  sphere[1].shine = 50.0;

  sphere[2].center = vec3(-1.0, 0.15, 1.5);
  sphere[2].radius = 0.5;
  sphere[2].color = vec3(0.1, 0.2, 0.8);
  sphere[2].shine = 5.0;

  sphere[3].center = vec3(0.0, -10.0, 0.0);
  sphere[3].radius = 9.0;
  sphere[3].color = vec3(0.4, 0.4, 0.4);
  sphere[3].shine = 10.0;

  Ray ray;

  ray.origin = cameraPosition;
  
  vec2 screePos = vec2(gl_FragCoord.xy/vec2(canvasWidth, canvasHeight));
  ray.direction = normalize(vec3(screePos * 2.0 - 1.0, -1.0));

  float tmin = 100000.0;
  int index;
  
  for(int i = 0; i < sphere.length(); i++)
  {
    float t = intersectSphere(ray, sphere[i]);
    if(t >= 0.0 && t < tmin)
    {
      tmin = t;
      index = i;
    }
  }

  if(tmin < 100000.0)
  {
    currColor = phongColor(sphere[index], tmin, ray);

    if(isReflection == 1.0)
    {
      vec4 color = reflectColor(sphere, tmin, ray, index);
      if(color != vec4(0.0, 0.0, 0.0, 0.0))
      {
        currColor += vec4(color.rgb, currColor.a);
      }
    }

    if(isShadow == 1.0)
    {
      if(shadowColor(sphere, tmin, ray, index) == 1.0)
      {
        currColor = vec4(currColor.rgb * 0.3, currColor.a);
      }
    }

    fragColor = currColor;
  }
  else fragColor = vec4(0.0, 0.0, 0.0, 1.0);
 
}`;

function pushMatrix(stack, m) {
  //necessary because javascript only does shallow push
  var copy = mat4.create(m);
  stack.push(copy);
}

function popMatrix(stack) {
  if (stack.length > 0) return stack.pop();
  else console.log("stack has no matrix to pop!");
}

function vertexShaderSetup() {
  shader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(shader, vertexShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function fragmentShaderSetup() {
  shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, fragShaderCode);
  gl.compileShader(shader);
  // Error check whether the shader is compiled correctly
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function initShaders(vertexShaderCode, fragShaderCode) {
  shaderProgram = gl.createProgram();

  var vertexShader = vertexShaderSetup(vertexShaderCode);
  var fragmentShader = fragmentShaderSetup(fragShaderCode);

  // attach the shaders
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  //link the shader program
  gl.linkProgram(shaderProgram);

  // check for compiiion and linking status
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
  }

  //finally use the program.
  gl.useProgram(shaderProgram);

  return shaderProgram;
}

function initGL(canvas) {
  try {
    gl = canvas.getContext("webgl2"); // the graphics webgl2 context
    gl.viewportWidth = canvas.width; // the width of the canvas
    gl.viewportHeight = canvas.height; // the height
  } catch (e) {}
  if (!gl) {
    alert("WebGL initialization failed");
  }
}

function degToRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function applyShadow()
{
  isShadow = 1.0;
  isReflection = 0.0;

  gl.uniform1f(uShadowLocation, isShadow);
  gl.uniform1f(uReflectionLocation, isReflection);

  drawScene();
}

function applyReflection()
{
  isShadow = 0.0;
  isReflection = 1.0;

  gl.uniform1f(uShadowLocation, isShadow);
  gl.uniform1f(uReflectionLocation, isReflection);

  drawScene();
}

function applyPhong()
{
  isShadow = 0.0;
  isReflection = 0.0;

  gl.uniform1f(uShadowLocation, isShadow);
  gl.uniform1f(uReflectionLocation, isReflection);

  drawScene();
}

function applyAll()
{
  isShadow = 1.0;
  isReflection = 1.0;

  gl.uniform1f(uShadowLocation, isShadow);
  gl.uniform1f(uReflectionLocation, isReflection);

  drawScene();
}

//The main drawing routine
function drawScene()
{
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  gl.clearColor(0.2, 0.2, 0.2, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT); 

  const bufData = new Float32Array([
    -1, 1, 0, 1, 1, 0, -1, -1, 0,
    -1, -1, 0, 1, 1, 0, 1, -1, 0]);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, bufData, gl.STATIC_DRAW);

  gl.vertexAttribPointer(aPositionLocation, 3, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  
}

function rotateLight()
{
  var angle = degToRad(lightSlider.value);
  lightPosition[0] = 4.0 * Math.sin(angle);
  lightPosition[2] = 4.0 * Math.cos(angle);

  gl.uniform3fv(uLightPositionLocation, lightPosition);

  drawScene();
}

function bounceValue()
{
  var bounce = bounceSlider.value;
  bounceLimit = bounce;

  gl.uniform1i(uBounceLocation, bounceLimit);

  drawScene();
}

// This is the entry point from the html
function webGLStart() {
  canvas = document.getElementById("Assignment_5");

  lightSlider = document.getElementById("lightDirection");
  lightSlider.addEventListener("input", rotateLight);

  bounceSlider = document.getElementById("bounceLimit");
  bounceSlider.addEventListener("input", bounceValue);

  initGL(canvas);

  shaderProgram = initShaders(vertexShaderCode, fragShaderCode);

  aPositionLocation = gl.getAttribLocation(shaderProgram, "a_position");

  uCanvasHeightLocation = gl.getUniformLocation(shaderProgram, "canvasHeight");
  uCanvasWidthLocation = gl.getUniformLocation(shaderProgram, "canvasWidth");
  uCameraPositionLocation = gl.getUniformLocation(shaderProgram, "cameraPosition");

  uLightIntensityLocation = gl.getUniformLocation(shaderProgram, "lightIntensity");
  uLightPositionLocation = gl.getUniformLocation(shaderProgram, "lightPosition");

  uShadowLocation = gl.getUniformLocation(shaderProgram, "isShadow");
  uReflectionLocation = gl.getUniformLocation(shaderProgram, "isReflection");

  uBounceLocation = gl.getUniformLocation(shaderProgram, "bounceLimit");

  gl.uniform1f(uCanvasWidthLocation, gl.viewportWidth);
  gl.uniform1f(uCanvasHeightLocation, gl.viewportHeight);

  gl.uniform3fv(uCameraPositionLocation, cameraPosition);

  gl.uniform3fv(uLightPositionLocation, lightPosition);
  gl.uniform1f(uLightIntensityLocation, lightIntensity);

  gl.uniform1i(uBounceLocation, bounceLimit);

  gl.enableVertexAttribArray(aPositionLocation);

  
  applyPhong();
}
