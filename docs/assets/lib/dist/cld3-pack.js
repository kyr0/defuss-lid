import { C as CLD3_LAYOUT } from './cld3-layout-D_LgBzys.js';
import { b as boostWeight, c as checkTop1 } from './boost-Bsc1WEV_.js';
import { p as parseContainer, t as toBytes } from './container-sM-fBKLB.js';

var Module = (function() {
  var _scriptDir = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : void 0;
  return (function(Module2) {
    Module2 = Module2 || {};
    var Module2 = typeof Module2 !== "undefined" ? Module2 : {};
    var moduleOverrides = {};
    var key;
    for (key in Module2) {
      if (Module2.hasOwnProperty(key)) {
        moduleOverrides[key] = Module2[key];
      }
    }
    var ENVIRONMENT_IS_WEB = false;
    var ENVIRONMENT_IS_WORKER = false;
    ENVIRONMENT_IS_WEB = typeof window === "object";
    ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
    typeof process === "object" && typeof process.versions === "object" && typeof process.versions.node === "string";
    if (Module2["ENVIRONMENT"]) {
      throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)");
    }
    var scriptDirectory = "";
    function locateFile(path) {
      if (Module2["locateFile"]) {
        return Module2["locateFile"](path, scriptDirectory);
      }
      return scriptDirectory + path;
    }
    var readBinary;
    if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href;
      } else if (document.currentScript) {
        scriptDirectory = document.currentScript.src;
      }
      if (_scriptDir) {
        scriptDirectory = _scriptDir;
      }
      if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1);
      } else {
        scriptDirectory = "";
      }
      if (!(typeof window === "object" || typeof importScripts === "function")) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
      if (ENVIRONMENT_IS_WORKER) {
        readBinary = function readBinary2(url) {
          try {
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response);
          } catch (err2) {
            var data = tryParseAsDataURI(url);
            if (data) {
              return data;
            }
            throw err2;
          }
        };
      }
    } else if (!Module2["wasmBinary"]) {
      throw new Error("WASM bytes required");
    }
    var out = Module2["print"] || console.log.bind(console);
    var err = Module2["printErr"] || console.warn.bind(console);
    for (key in moduleOverrides) {
      if (moduleOverrides.hasOwnProperty(key)) {
        Module2[key] = moduleOverrides[key];
      }
    }
    moduleOverrides = null;
    if (Module2["arguments"]) Module2["arguments"];
    if (!Object.getOwnPropertyDescriptor(Module2, "arguments")) Object.defineProperty(Module2, "arguments", { get: function() {
      abort("Module.arguments has been replaced with plain arguments_");
    } });
    if (Module2["thisProgram"]) Module2["thisProgram"];
    if (!Object.getOwnPropertyDescriptor(Module2, "thisProgram")) Object.defineProperty(Module2, "thisProgram", { get: function() {
      abort("Module.thisProgram has been replaced with plain thisProgram");
    } });
    if (Module2["quit"]) Module2["quit"];
    if (!Object.getOwnPropertyDescriptor(Module2, "quit")) Object.defineProperty(Module2, "quit", { get: function() {
      abort("Module.quit has been replaced with plain quit_");
    } });
    assert(typeof Module2["memoryInitializerPrefixURL"] === "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");
    assert(typeof Module2["pthreadMainPrefixURL"] === "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");
    assert(typeof Module2["cdInitializerPrefixURL"] === "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");
    assert(typeof Module2["filePackagePrefixURL"] === "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");
    assert(typeof Module2["read"] === "undefined", "Module.read option was removed (modify read_ in JS)");
    assert(typeof Module2["readAsync"] === "undefined", "Module.readAsync option was removed (modify readAsync in JS)");
    assert(typeof Module2["readBinary"] === "undefined", "Module.readBinary option was removed (modify readBinary in JS)");
    assert(typeof Module2["setWindowTitle"] === "undefined", "Module.setWindowTitle option was removed (modify setWindowTitle in JS)");
    if (!Object.getOwnPropertyDescriptor(Module2, "read")) Object.defineProperty(Module2, "read", { get: function() {
      abort("Module.read has been replaced with plain read_");
    } });
    if (!Object.getOwnPropertyDescriptor(Module2, "readAsync")) Object.defineProperty(Module2, "readAsync", { get: function() {
      abort("Module.readAsync has been replaced with plain readAsync");
    } });
    if (!Object.getOwnPropertyDescriptor(Module2, "readBinary")) Object.defineProperty(Module2, "readBinary", { get: function() {
      abort("Module.readBinary has been replaced with plain readBinary");
    } });
    stackSave = stackRestore = stackAlloc = function() {
      abort("cannot use the stack before compiled code is ready to run, and has provided stack access");
    };
    function warnOnce(text) {
      if (!warnOnce.shown) warnOnce.shown = {};
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        err(text);
      }
    }
    var asm2wasmImports = { "f64-rem": function(x, y) {
      return x % y;
    }, "debugger": function() {
      debugger;
    } };
    new Array(0);
    var tempRet0 = 0;
    var setTempRet0 = function(value) {
      tempRet0 = value;
    };
    var getTempRet0 = function() {
      return tempRet0;
    };
    var wasmBinary;
    if (Module2["wasmBinary"]) wasmBinary = Module2["wasmBinary"];
    if (!Object.getOwnPropertyDescriptor(Module2, "wasmBinary")) Object.defineProperty(Module2, "wasmBinary", { get: function() {
      abort("Module.wasmBinary has been replaced with plain wasmBinary");
    } });
    if (Module2["noExitRuntime"]) Module2["noExitRuntime"];
    if (!Object.getOwnPropertyDescriptor(Module2, "noExitRuntime")) Object.defineProperty(Module2, "noExitRuntime", { get: function() {
      abort("Module.noExitRuntime has been replaced with plain noExitRuntime");
    } });
    if (typeof WebAssembly !== "object") {
      abort("No WebAssembly support found. Build with -s WASM=0 to target JavaScript instead.");
    }
    function setValue(ptr, value, type, noSafe) {
      type = type || "i8";
      if (type.charAt(type.length - 1) === "*") type = "i32";
      switch (type) {
        case "i1":
          HEAP8[ptr >> 0] = value;
          break;
        case "i8":
          HEAP8[ptr >> 0] = value;
          break;
        case "i16":
          HEAP16[ptr >> 1] = value;
          break;
        case "i32":
          HEAP32[ptr >> 2] = value;
          break;
        case "i64":
          tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
          break;
        case "float":
          HEAPF32[ptr >> 2] = value;
          break;
        case "double":
          HEAPF64[ptr >> 3] = value;
          break;
        default:
          abort("invalid type for setValue: " + type);
      }
    }
    function getValue(ptr, type, noSafe) {
      type = type || "i8";
      if (type.charAt(type.length - 1) === "*") type = "i32";
      switch (type) {
        case "i1":
          return HEAP8[ptr >> 0];
        case "i8":
          return HEAP8[ptr >> 0];
        case "i16":
          return HEAP16[ptr >> 1];
        case "i32":
          return HEAP32[ptr >> 2];
        case "i64":
          return HEAP32[ptr >> 2];
        case "float":
          return HEAPF32[ptr >> 2];
        case "double":
          return HEAPF64[ptr >> 3];
        default:
          abort("invalid type for getValue: " + type);
      }
      return null;
    }
    var wasmMemory;
    var ABORT = false;
    function assert(condition, text) {
      if (!condition) {
        abort("Assertion failed: " + text);
      }
    }
    function getCFunc(ident) {
      var func = Module2["_" + ident];
      assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
      return func;
    }
    function ccall(ident, returnType, argTypes, args, opts) {
      var toC = { "string": function(str) {
        var ret2 = 0;
        if (str !== null && str !== void 0 && str !== 0) {
          var len = (str.length << 2) + 1;
          ret2 = stackAlloc(len);
          stringToUTF8(str, ret2, len);
        }
        return ret2;
      }, "array": function(arr) {
        var ret2 = stackAlloc(arr.length);
        writeArrayToMemory(arr, ret2);
        return ret2;
      } };
      function convertReturnValue(ret2) {
        if (returnType === "string") return UTF8ToString(ret2);
        if (returnType === "boolean") return Boolean(ret2);
        return ret2;
      }
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      assert(returnType !== "array", 'Return type should not be "array".');
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func.apply(null, cArgs);
      ret = convertReturnValue(ret);
      if (stack !== 0) stackRestore(stack);
      return ret;
    }
    function cwrap(ident, returnType, argTypes, opts) {
      return function() {
        return ccall(ident, returnType, argTypes, arguments);
      };
    }
    var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : void 0;
    function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
      var endIdx = idx + maxBytesToRead;
      var endPtr = idx;
      while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
      if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
      } else {
        var str = "";
        while (idx < endPtr) {
          var u0 = u8Array[idx++];
          if (!(u0 & 128)) {
            str += String.fromCharCode(u0);
            continue;
          }
          var u1 = u8Array[idx++] & 63;
          if ((u0 & 224) == 192) {
            str += String.fromCharCode((u0 & 31) << 6 | u1);
            continue;
          }
          var u2 = u8Array[idx++] & 63;
          if ((u0 & 240) == 224) {
            u0 = (u0 & 15) << 12 | u1 << 6 | u2;
          } else {
            if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte 0x" + u0.toString(16) + " encountered when deserializing a UTF-8 string on the asm.js/wasm heap to a JS string!");
            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63;
          }
          if (u0 < 65536) {
            str += String.fromCharCode(u0);
          } else {
            var ch = u0 - 65536;
            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
          }
        }
      }
      return str;
    }
    function UTF8ToString(ptr, maxBytesToRead) {
      return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
    }
    function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
      if (!(maxBytesToWrite > 0)) return 0;
      var startIdx = outIdx;
      var endIdx = outIdx + maxBytesToWrite - 1;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i);
          u = 65536 + ((u & 1023) << 10) | u1 & 1023;
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break;
          outU8Array[outIdx++] = u;
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break;
          outU8Array[outIdx++] = 192 | u >> 6;
          outU8Array[outIdx++] = 128 | u & 63;
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break;
          outU8Array[outIdx++] = 224 | u >> 12;
          outU8Array[outIdx++] = 128 | u >> 6 & 63;
          outU8Array[outIdx++] = 128 | u & 63;
        } else {
          if (outIdx + 3 >= endIdx) break;
          if (u >= 2097152) warnOnce("Invalid Unicode code point 0x" + u.toString(16) + " encountered when serializing a JS string to an UTF-8 string on the asm.js/wasm heap! (Valid unicode code points should be in range 0-0x1FFFFF).");
          outU8Array[outIdx++] = 240 | u >> 18;
          outU8Array[outIdx++] = 128 | u >> 12 & 63;
          outU8Array[outIdx++] = 128 | u >> 6 & 63;
          outU8Array[outIdx++] = 128 | u & 63;
        }
      }
      outU8Array[outIdx] = 0;
      return outIdx - startIdx;
    }
    function stringToUTF8(str, outPtr, maxBytesToWrite) {
      assert(typeof maxBytesToWrite == "number", "stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!");
      return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    }
    function lengthBytesUTF8(str) {
      var len = 0;
      for (var i = 0; i < str.length; ++i) {
        var u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127) ++len;
        else if (u <= 2047) len += 2;
        else if (u <= 65535) len += 3;
        else len += 4;
      }
      return len;
    }
    typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : void 0;
    function allocateUTF8(str) {
      var size = lengthBytesUTF8(str) + 1;
      var ret = _malloc(size);
      if (ret) stringToUTF8Array(str, HEAP8, ret, size);
      return ret;
    }
    function writeArrayToMemory(array, buffer2) {
      assert(array.length >= 0, "writeArrayToMemory array must have a length (should be an array or typed array)");
      HEAP8.set(array, buffer2);
    }
    var WASM_PAGE_SIZE = 65536;
    var buffer, HEAP8, HEAPU8, HEAP16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
    function updateGlobalBufferAndViews(buf) {
      buffer = buf;
      Module2["HEAP8"] = HEAP8 = new Int8Array(buf);
      Module2["HEAP16"] = HEAP16 = new Int16Array(buf);
      Module2["HEAP32"] = HEAP32 = new Int32Array(buf);
      Module2["HEAPU8"] = HEAPU8 = new Uint8Array(buf);
      Module2["HEAPU16"] = new Uint16Array(buf);
      Module2["HEAPU32"] = HEAPU32 = new Uint32Array(buf);
      Module2["HEAPF32"] = HEAPF32 = new Float32Array(buf);
      Module2["HEAPF64"] = HEAPF64 = new Float64Array(buf);
    }
    var STACK_BASE = 445856, STACK_MAX = 5688736, DYNAMIC_BASE = 5688736, DYNAMICTOP_PTR = 445824;
    assert(STACK_BASE % 16 === 0, "stack must start aligned");
    assert(DYNAMIC_BASE % 16 === 0, "heap must start aligned");
    var TOTAL_STACK = 5242880;
    if (Module2["TOTAL_STACK"]) assert(TOTAL_STACK === Module2["TOTAL_STACK"], "the stack size can no longer be determined at runtime");
    var INITIAL_TOTAL_MEMORY = Module2["TOTAL_MEMORY"] || 16777216;
    if (!Object.getOwnPropertyDescriptor(Module2, "TOTAL_MEMORY")) Object.defineProperty(Module2, "TOTAL_MEMORY", { get: function() {
      abort("Module.TOTAL_MEMORY has been replaced with plain INITIAL_TOTAL_MEMORY");
    } });
    assert(INITIAL_TOTAL_MEMORY >= TOTAL_STACK, "TOTAL_MEMORY should be larger than TOTAL_STACK, was " + INITIAL_TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
    assert(typeof Int32Array !== "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray !== void 0 && Int32Array.prototype.set !== void 0, "JS engine does not provide full typed array support");
    if (Module2["wasmMemory"]) {
      wasmMemory = Module2["wasmMemory"];
    } else {
      wasmMemory = new WebAssembly.Memory({ "initial": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE, "maximum": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE });
    }
    if (wasmMemory) {
      buffer = wasmMemory.buffer;
    }
    INITIAL_TOTAL_MEMORY = buffer.byteLength;
    assert(INITIAL_TOTAL_MEMORY % WASM_PAGE_SIZE === 0);
    updateGlobalBufferAndViews(buffer);
    HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
    function writeStackCookie() {
      assert((STACK_MAX & 3) == 0);
      HEAPU32[(STACK_MAX >> 2) - 1] = 34821223;
      HEAPU32[(STACK_MAX >> 2) - 2] = 2310721022;
    }
    function checkStackCookie() {
      var cookie1 = HEAPU32[(STACK_MAX >> 2) - 1];
      var cookie2 = HEAPU32[(STACK_MAX >> 2) - 2];
      if (cookie1 != 34821223 || cookie2 != 2310721022) {
        abort("Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x" + cookie2.toString(16) + " " + cookie1.toString(16));
      }
      if (HEAP32[0] !== 1668509029) abort("Runtime error: The application has corrupted its heap memory area (address zero)!");
    }
    function abortStackOverflow(allocSize) {
      abort("Stack overflow! Attempted to allocate " + allocSize + " bytes on the stack, but stack has only " + (STACK_MAX - stackSave() + allocSize) + " bytes available!");
    }
    HEAP32[0] = 1668509029;
    HEAP16[1] = 25459;
    if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99) throw "Runtime error: expected the system to be little-endian!";
    function abortFnPtrError(ptr, sig) {
      abort("Invalid function pointer " + ptr + " called with signature '" + sig + "'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this). Build with ASSERTIONS=2 for more info.");
    }
    function callRuntimeCallbacks(callbacks) {
      while (callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == "function") {
          callback();
          continue;
        }
        var func = callback.func;
        if (typeof func === "number") {
          if (callback.arg === void 0) {
            Module2["dynCall_v"](func);
          } else {
            Module2["dynCall_vi"](func, callback.arg);
          }
        } else {
          func(callback.arg === void 0 ? null : callback.arg);
        }
      }
    }
    var __ATPRERUN__ = [];
    var __ATINIT__ = [];
    var __ATMAIN__ = [];
    var __ATPOSTRUN__ = [];
    var runtimeInitialized = false;
    function preRun() {
      if (Module2["preRun"]) {
        if (typeof Module2["preRun"] == "function") Module2["preRun"] = [Module2["preRun"]];
        while (Module2["preRun"].length) {
          addOnPreRun(Module2["preRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPRERUN__);
    }
    function initRuntime() {
      checkStackCookie();
      assert(!runtimeInitialized);
      runtimeInitialized = true;
      callRuntimeCallbacks(__ATINIT__);
    }
    function preMain() {
      checkStackCookie();
      callRuntimeCallbacks(__ATMAIN__);
    }
    function postRun() {
      checkStackCookie();
      if (Module2["postRun"]) {
        if (typeof Module2["postRun"] == "function") Module2["postRun"] = [Module2["postRun"]];
        while (Module2["postRun"].length) {
          addOnPostRun(Module2["postRun"].shift());
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__);
    }
    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb);
    }
    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb);
    }
    assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
    assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
    assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
    assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");
    var Math_abs = Math.abs;
    var Math_ceil = Math.ceil;
    var Math_floor = Math.floor;
    var Math_min = Math.min;
    var runDependencies = 0;
    var runDependencyWatcher = null;
    var dependenciesFulfilled = null;
    var runDependencyTracking = {};
    function addRunDependency(id) {
      runDependencies++;
      if (Module2["monitorRunDependencies"]) {
        Module2["monitorRunDependencies"](runDependencies);
      }
      {
        assert(!runDependencyTracking[id]);
        runDependencyTracking[id] = 1;
        if (runDependencyWatcher === null && typeof setInterval !== "undefined") {
          runDependencyWatcher = setInterval(function() {
            if (ABORT) {
              clearInterval(runDependencyWatcher);
              runDependencyWatcher = null;
              return;
            }
            var shown = false;
            for (var dep in runDependencyTracking) {
              if (!shown) {
                shown = true;
                err("still waiting on run dependencies:");
              }
              err("dependency: " + dep);
            }
            if (shown) {
              err("(end of list)");
            }
          }, 1e4);
        }
      }
    }
    function removeRunDependency(id) {
      runDependencies--;
      if (Module2["monitorRunDependencies"]) {
        Module2["monitorRunDependencies"](runDependencies);
      }
      {
        assert(runDependencyTracking[id]);
        delete runDependencyTracking[id];
      }
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled;
          dependenciesFulfilled = null;
          callback();
        }
      }
    }
    Module2["preloadedImages"] = {};
    Module2["preloadedAudios"] = {};
    var FS = { error: function() {
      abort("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1");
    }, init: function() {
      FS.error();
    }, createDataFile: function() {
      FS.error();
    }, createPreloadedFile: function() {
      FS.error();
    }, createLazyFile: function() {
      FS.error();
    }, open: function() {
      FS.error();
    }, mkdev: function() {
      FS.error();
    }, registerDevice: function() {
      FS.error();
    }, analyzePath: function() {
      FS.error();
    }, loadFilesFromDB: function() {
      FS.error();
    }, ErrnoError: function ErrnoError() {
      FS.error();
    } };
    Module2["FS_createDataFile"] = FS.createDataFile;
    Module2["FS_createPreloadedFile"] = FS.createPreloadedFile;
    var dataURIPrefix = "data:application/octet-stream;base64,";
    function isDataURI(filename) {
      return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0;
    }
    var wasmBinaryFile = "cld3-supplied-in-memory.wasm";
    if (!isDataURI(wasmBinaryFile)) {
      wasmBinaryFile = locateFile(wasmBinaryFile);
    }
    function getBinary() {
      try {
        if (wasmBinary) {
          return new Uint8Array(wasmBinary);
        }
        var binary = tryParseAsDataURI(wasmBinaryFile);
        if (binary) {
          return binary;
        }
        if (readBinary) {
          return readBinary(wasmBinaryFile);
        } else {
          throw "both async and sync fetching of the wasm failed";
        }
      } catch (err2) {
        abort(err2);
      }
    }
    function getBinaryPromise() {
      if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
        return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
          if (!response["ok"]) {
            throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
          }
          return response["arrayBuffer"]();
        }).catch(function() {
          return getBinary();
        });
      }
      return new Promise(function(resolve, reject) {
        resolve(getBinary());
      });
    }
    function createWasm(env) {
      var info = { "env": env, "wasi_unstable": env, "global": { "NaN": NaN, Infinity: Infinity }, "global.Math": Math, "asm2wasm": asm2wasmImports };
      function receiveInstance(instance, module) {
        var exports2 = instance.exports;
        Module2["asm"] = exports2;
        removeRunDependency("wasm-instantiate");
      }
      addRunDependency("wasm-instantiate");
      var trueModule = Module2;
      function receiveInstantiatedSource(output) {
        assert(Module2 === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
        trueModule = null;
        receiveInstance(output["instance"]);
      }
      function instantiateArrayBuffer(receiver) {
        return getBinaryPromise().then(function(binary) {
          return WebAssembly.instantiate(binary, info);
        }).then(receiver, function(reason) {
          err("failed to asynchronously prepare wasm: " + reason);
          abort(reason);
        });
      }
      function instantiateAsync() {
        if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
          fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(response) {
            var result = WebAssembly.instantiateStreaming(response, info);
            return result.then(receiveInstantiatedSource, function(reason) {
              err("wasm streaming compile failed: " + reason);
              err("falling back to ArrayBuffer instantiation");
              instantiateArrayBuffer(receiveInstantiatedSource);
            });
          });
        } else {
          return instantiateArrayBuffer(receiveInstantiatedSource);
        }
      }
      if (Module2["instantiateWasm"]) {
        try {
          var exports = Module2["instantiateWasm"](info, receiveInstance);
          return exports;
        } catch (e) {
          err("Module.instantiateWasm callback failed with error: " + e);
          return false;
        }
      }
      instantiateAsync();
      return {};
    }
    Module2["asm"] = function(global, env, providedBuffer) {
      env["memory"] = wasmMemory;
      env["table"] = new WebAssembly.Table({ "initial": 403, "maximum": 403, "element": "anyfunc" });
      env["__memory_base"] = 1024;
      env["__table_base"] = 0;
      var exports = createWasm(env);
      assert(exports, "binaryen setup failed (no wasm support?)");
      return exports;
    };
    var tempDouble;
    var tempI64;
    __ATINIT__.push({ func: function() {
      __GLOBAL__sub_I_status_cc();
    } });
    var tempDoublePtr = 445840;
    assert(tempDoublePtr % 8 == 0);
    function demangle(func) {
      warnOnce("warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling");
      return func;
    }
    function demangleAll(text) {
      var regex = /\b__Z[\w\d_]+/g;
      return text.replace(regex, function(x) {
        var y = demangle(x);
        return x === y ? x : y + " [" + x + "]";
      });
    }
    function jsStackTrace() {
      var err2 = new Error();
      if (!err2.stack) {
        try {
          throw new Error(0);
        } catch (e) {
          err2 = e;
        }
        if (!err2.stack) {
          return "(no stack trace available)";
        }
      }
      return err2.stack.toString();
    }
    function stackTrace() {
      var js = jsStackTrace();
      if (Module2["extraStackTrace"]) js += "\n" + Module2["extraStackTrace"]();
      return demangleAll(js);
    }
    function ___assert_fail(condition, filename, line, func) {
      abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"]);
    }
    function ___cxa_allocate_exception(size) {
      return _malloc(size);
    }
    var ___exception_infos = {};
    function ___exception_addRef(ptr) {
      if (!ptr) return;
      var info = ___exception_infos[ptr];
      info.refcount++;
    }
    function ___exception_deAdjust(adjusted) {
      if (!adjusted || ___exception_infos[adjusted]) return adjusted;
      for (var key2 in ___exception_infos) {
        var ptr = +key2;
        var adj = ___exception_infos[ptr].adjusted;
        var len = adj.length;
        for (var i = 0; i < len; i++) {
          if (adj[i] === adjusted) {
            return ptr;
          }
        }
      }
      return adjusted;
    }
    function ___cxa_begin_catch(ptr) {
      var info = ___exception_infos[ptr];
      if (info && !info.caught) {
        info.caught = true;
        __ZSt18uncaught_exceptionv.uncaught_exceptions--;
      }
      if (info) info.rethrown = false;
      ___exception_addRef(___exception_deAdjust(ptr));
      return ptr;
    }
    function ___cxa_pure_virtual() {
      ABORT = true;
      throw "Pure virtual function called!";
    }
    function ___cxa_throw(ptr, type, destructor) {
      ___exception_infos[ptr] = { ptr, adjusted: [ptr], type, destructor, refcount: 0, caught: false, rethrown: false };
      if (!("uncaught_exception" in __ZSt18uncaught_exceptionv)) {
        __ZSt18uncaught_exceptionv.uncaught_exceptions = 1;
      } else {
        __ZSt18uncaught_exceptionv.uncaught_exceptions++;
      }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }
    function ___cxa_uncaught_exceptions() {
      return __ZSt18uncaught_exceptionv.uncaught_exceptions;
    }
    function ___gxx_personality_v0() {
    }
    function ___lock() {
    }
    var SYSCALLS = { buffers: [null, [], []], printChar: function(stream, curr) {
      var buffer2 = SYSCALLS.buffers[stream];
      assert(buffer2);
      if (curr === 0 || curr === 10) {
        (stream === 1 ? out : err)(UTF8ArrayToString(buffer2, 0));
        buffer2.length = 0;
      } else {
        buffer2.push(curr);
      }
    }, varargs: 0, get: function(varargs) {
      SYSCALLS.varargs += 4;
      var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
      return ret;
    }, getStr: function() {
      var ret = UTF8ToString(SYSCALLS.get());
      return ret;
    }, get64: function() {
      var low = SYSCALLS.get(), high = SYSCALLS.get();
      if (low >= 0) assert(high === 0);
      else assert(high === -1);
      return low;
    }, getZero: function() {
      assert(SYSCALLS.get() === 0);
    } };
    function ___syscall140(which, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
        abort("it should not be possible to operate on streams when !SYSCALLS_REQUIRE_FILESYSTEM");
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___syscall6(which, varargs) {
      SYSCALLS.varargs = varargs;
      try {
        var stream = SYSCALLS.getStreamFromFD();
        abort("it should not be possible to operate on streams when !SYSCALLS_REQUIRE_FILESYSTEM");
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___unlock() {
    }
    function flush_NO_FILESYSTEM() {
      var fflush = Module2["_fflush"];
      if (fflush) fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }
    function _fd_write(stream, iov, iovcnt, pnum) {
      try {
        var num = 0;
        for (var i = 0; i < iovcnt; i++) {
          var ptr = HEAP32[iov + i * 8 >> 2];
          var len = HEAP32[iov + (i * 8 + 4) >> 2];
          for (var j = 0; j < len; j++) {
            SYSCALLS.printChar(stream, HEAPU8[ptr + j]);
          }
          num += len;
        }
        HEAP32[pnum >> 2] = num;
        return 0;
      } catch (e) {
        if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
        return -e.errno;
      }
    }
    function ___wasi_fd_write() {
      return _fd_write.apply(null, arguments);
    }
    function _abort() {
      Module2["abort"]();
    }
    function _emscripten_get_heap_size() {
      return HEAP8.length;
    }
    function _llvm_trap() {
      abort("trap!");
    }
    function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    }
    function _pthread_equal(x, y) {
      return x == y;
    }
    function ___setErrNo(value) {
      if (Module2["___errno_location"]) HEAP32[Module2["___errno_location"]() >> 2] = value;
      else err("failed to set errno from JS");
      return value;
    }
    function abortOnCannotGrowMemory(requestedSize) {
      abort("Cannot enlarge memory arrays to size " + requestedSize + " bytes (OOM). Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " + HEAP8.length + ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ");
    }
    function _emscripten_resize_heap(requestedSize) {
      abortOnCannotGrowMemory(requestedSize);
    }
    var decodeBase64 = typeof atob === "function" ? atob : function(input) {
      var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      var output = "";
      var chr1, chr2, chr3;
      var enc1, enc2, enc3, enc4;
      var i = 0;
      input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
      do {
        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));
        chr1 = enc1 << 2 | enc2 >> 4;
        chr2 = (enc2 & 15) << 4 | enc3 >> 2;
        chr3 = (enc3 & 3) << 6 | enc4;
        output = output + String.fromCharCode(chr1);
        if (enc3 !== 64) {
          output = output + String.fromCharCode(chr2);
        }
        if (enc4 !== 64) {
          output = output + String.fromCharCode(chr3);
        }
      } while (i < input.length);
      return output;
    };
    function intArrayFromBase64(s) {
      try {
        var decoded = decodeBase64(s);
        var bytes = new Uint8Array(decoded.length);
        for (var i = 0; i < decoded.length; ++i) {
          bytes[i] = decoded.charCodeAt(i);
        }
        return bytes;
      } catch (_) {
        throw new Error("Converting base64 string to bytes failed.");
      }
    }
    function tryParseAsDataURI(filename) {
      if (!isDataURI(filename)) {
        return;
      }
      return intArrayFromBase64(filename.slice(dataURIPrefix.length));
    }
    function nullFunc_i(x) {
      abortFnPtrError(x, "i");
    }
    function nullFunc_ii(x) {
      abortFnPtrError(x, "ii");
    }
    function nullFunc_iii(x) {
      abortFnPtrError(x, "iii");
    }
    function nullFunc_iiii(x) {
      abortFnPtrError(x, "iiii");
    }
    function nullFunc_ji(x) {
      abortFnPtrError(x, "ji");
    }
    function nullFunc_jiiii(x) {
      abortFnPtrError(x, "jiiii");
    }
    function nullFunc_jiji(x) {
      abortFnPtrError(x, "jiji");
    }
    function nullFunc_v(x) {
      abortFnPtrError(x, "v");
    }
    function nullFunc_vi(x) {
      abortFnPtrError(x, "vi");
    }
    function nullFunc_vii(x) {
      abortFnPtrError(x, "vii");
    }
    function nullFunc_viii(x) {
      abortFnPtrError(x, "viii");
    }
    function nullFunc_viiii(x) {
      abortFnPtrError(x, "viiii");
    }
    function nullFunc_viiiii(x) {
      abortFnPtrError(x, "viiiii");
    }
    function nullFunc_viiiiii(x) {
      abortFnPtrError(x, "viiiiii");
    }
    function nullFunc_viij(x) {
      abortFnPtrError(x, "viij");
    }
    function nullFunc_viji(x) {
      abortFnPtrError(x, "viji");
    }
    var asmGlobalArg = {};
    var asmLibraryArg = { "abort": abort, "setTempRet0": setTempRet0, "getTempRet0": getTempRet0, "abortStackOverflow": abortStackOverflow, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iii": nullFunc_iii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_ji": nullFunc_ji, "nullFunc_jiiii": nullFunc_jiiii, "nullFunc_jiji": nullFunc_jiji, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_viii": nullFunc_viii, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "nullFunc_viij": nullFunc_viij, "nullFunc_viji": nullFunc_viji, "___assert_fail": ___assert_fail, "___cxa_allocate_exception": ___cxa_allocate_exception, "___cxa_begin_catch": ___cxa_begin_catch, "___cxa_pure_virtual": ___cxa_pure_virtual, "___cxa_throw": ___cxa_throw, "___cxa_uncaught_exceptions": ___cxa_uncaught_exceptions, "___exception_addRef": ___exception_addRef, "___exception_deAdjust": ___exception_deAdjust, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall6": ___syscall6, "___unlock": ___unlock, "___wasi_fd_write": ___wasi_fd_write, "_abort": _abort, "_emscripten_get_heap_size": _emscripten_get_heap_size, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_emscripten_resize_heap": _emscripten_resize_heap, "_fd_write": _fd_write, "_llvm_trap": _llvm_trap, "_pthread_equal": _pthread_equal, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "demangle": demangle, "demangleAll": demangleAll, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "jsStackTrace": jsStackTrace, "stackTrace": stackTrace, "tempDoublePtr": tempDoublePtr, "DYNAMICTOP_PTR": DYNAMICTOP_PTR };
    var asm = Module2["asm"](asmGlobalArg, asmLibraryArg, buffer);
    Module2["asm"] = asm;
    Module2["_Cld_create"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_Cld_create"].apply(null, arguments);
    };
    Module2["_Cld_destroy"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_Cld_destroy"].apply(null, arguments);
    };
    Module2["_Cld_findLanguage"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_Cld_findLanguage"].apply(null, arguments);
    };
    Module2["_Cld_findTopNMostFreqLangs"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_Cld_findTopNMostFreqLangs"].apply(null, arguments);
    };
    var __GLOBAL__sub_I_status_cc = Module2["__GLOBAL__sub_I_status_cc"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["__GLOBAL__sub_I_status_cc"].apply(null, arguments);
    };
    var __ZSt18uncaught_exceptionv = Module2["__ZSt18uncaught_exceptionv"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["__ZSt18uncaught_exceptionv"].apply(null, arguments);
    };
    Module2["___cxa_can_catch"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["___cxa_can_catch"].apply(null, arguments);
    };
    Module2["___cxa_is_pointer_type"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["___cxa_is_pointer_type"].apply(null, arguments);
    };
    Module2["___errno_location"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["___errno_location"].apply(null, arguments);
    };
    Module2["_fflush"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_fflush"].apply(null, arguments);
    };
    Module2["_free"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_free"].apply(null, arguments);
    };
    Module2["_get_MaxNumBytesDefault"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_get_MaxNumBytesDefault"].apply(null, arguments);
    };
    Module2["_get_MaxNumBytesInput"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_get_MaxNumBytesInput"].apply(null, arguments);
    };
    Module2["_get_MinNumBytesDefault"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_get_MinNumBytesDefault"].apply(null, arguments);
    };
    Module2["_get_SizeLanguageResult"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_get_SizeLanguageResult"].apply(null, arguments);
    };
    Module2["_get_UnknownIdentifier"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_get_UnknownIdentifier"].apply(null, arguments);
    };
    var _malloc = Module2["_malloc"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_malloc"].apply(null, arguments);
    };
    Module2["_memcpy"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_memcpy"].apply(null, arguments);
    };
    Module2["_memmove"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_memmove"].apply(null, arguments);
    };
    Module2["_memset"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_memset"].apply(null, arguments);
    };
    Module2["_sbrk"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["_sbrk"].apply(null, arguments);
    };
    Module2["establishStackSpace"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["establishStackSpace"].apply(null, arguments);
    };
    var stackAlloc = Module2["stackAlloc"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["stackAlloc"].apply(null, arguments);
    };
    var stackRestore = Module2["stackRestore"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["stackRestore"].apply(null, arguments);
    };
    var stackSave = Module2["stackSave"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["stackSave"].apply(null, arguments);
    };
    Module2["dynCall_i"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_i"].apply(null, arguments);
    };
    Module2["dynCall_ii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_ii"].apply(null, arguments);
    };
    Module2["dynCall_iii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_iii"].apply(null, arguments);
    };
    Module2["dynCall_iiii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_iiii"].apply(null, arguments);
    };
    Module2["dynCall_ji"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_ji"].apply(null, arguments);
    };
    Module2["dynCall_jiiii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_jiiii"].apply(null, arguments);
    };
    Module2["dynCall_jiji"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_jiji"].apply(null, arguments);
    };
    Module2["dynCall_v"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_v"].apply(null, arguments);
    };
    Module2["dynCall_vi"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_vi"].apply(null, arguments);
    };
    Module2["dynCall_vii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_vii"].apply(null, arguments);
    };
    Module2["dynCall_viii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_viii"].apply(null, arguments);
    };
    Module2["dynCall_viiii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_viiii"].apply(null, arguments);
    };
    Module2["dynCall_viiiii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_viiiii"].apply(null, arguments);
    };
    Module2["dynCall_viiiiii"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_viiiiii"].apply(null, arguments);
    };
    Module2["dynCall_viij"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_viij"].apply(null, arguments);
    };
    Module2["dynCall_viji"] = function() {
      assert(runtimeInitialized, "you need to wait for the runtime to be ready (e.g. wait for main() to be called)");
      assert(true, "the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)");
      return Module2["asm"]["dynCall_viji"].apply(null, arguments);
    };
    Module2["asm"] = asm;
    if (!Object.getOwnPropertyDescriptor(Module2, "intArrayFromString")) Module2["intArrayFromString"] = function() {
      abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "intArrayToString")) Module2["intArrayToString"] = function() {
      abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "ccall")) Module2["ccall"] = function() {
      abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    Module2["cwrap"] = cwrap;
    Module2["setValue"] = setValue;
    Module2["getValue"] = getValue;
    if (!Object.getOwnPropertyDescriptor(Module2, "allocate")) Module2["allocate"] = function() {
      abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "getMemory")) Module2["getMemory"] = function() {
      abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "AsciiToString")) Module2["AsciiToString"] = function() {
      abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "stringToAscii")) Module2["stringToAscii"] = function() {
      abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "UTF8ArrayToString")) Module2["UTF8ArrayToString"] = function() {
      abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    Module2["UTF8ToString"] = UTF8ToString;
    if (!Object.getOwnPropertyDescriptor(Module2, "stringToUTF8Array")) Module2["stringToUTF8Array"] = function() {
      abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    Module2["stringToUTF8"] = stringToUTF8;
    if (!Object.getOwnPropertyDescriptor(Module2, "lengthBytesUTF8")) Module2["lengthBytesUTF8"] = function() {
      abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "UTF16ToString")) Module2["UTF16ToString"] = function() {
      abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "stringToUTF16")) Module2["stringToUTF16"] = function() {
      abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "lengthBytesUTF16")) Module2["lengthBytesUTF16"] = function() {
      abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "UTF32ToString")) Module2["UTF32ToString"] = function() {
      abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "stringToUTF32")) Module2["stringToUTF32"] = function() {
      abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "lengthBytesUTF32")) Module2["lengthBytesUTF32"] = function() {
      abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    Module2["allocateUTF8"] = allocateUTF8;
    if (!Object.getOwnPropertyDescriptor(Module2, "stackTrace")) Module2["stackTrace"] = function() {
      abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addOnPreRun")) Module2["addOnPreRun"] = function() {
      abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addOnInit")) Module2["addOnInit"] = function() {
      abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addOnPreMain")) Module2["addOnPreMain"] = function() {
      abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addOnExit")) Module2["addOnExit"] = function() {
      abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addOnPostRun")) Module2["addOnPostRun"] = function() {
      abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "writeStringToMemory")) Module2["writeStringToMemory"] = function() {
      abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "writeArrayToMemory")) Module2["writeArrayToMemory"] = function() {
      abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "writeAsciiToMemory")) Module2["writeAsciiToMemory"] = function() {
      abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addRunDependency")) Module2["addRunDependency"] = function() {
      abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "removeRunDependency")) Module2["removeRunDependency"] = function() {
      abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "ENV")) Module2["ENV"] = function() {
      abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS")) Module2["FS"] = function() {
      abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createFolder")) Module2["FS_createFolder"] = function() {
      abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createPath")) Module2["FS_createPath"] = function() {
      abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createDataFile")) Module2["FS_createDataFile"] = function() {
      abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createPreloadedFile")) Module2["FS_createPreloadedFile"] = function() {
      abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createLazyFile")) Module2["FS_createLazyFile"] = function() {
      abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createLink")) Module2["FS_createLink"] = function() {
      abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_createDevice")) Module2["FS_createDevice"] = function() {
      abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "FS_unlink")) Module2["FS_unlink"] = function() {
      abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "GL")) Module2["GL"] = function() {
      abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "dynamicAlloc")) Module2["dynamicAlloc"] = function() {
      abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "loadDynamicLibrary")) Module2["loadDynamicLibrary"] = function() {
      abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "loadWebAssemblyModule")) Module2["loadWebAssemblyModule"] = function() {
      abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "getLEB")) Module2["getLEB"] = function() {
      abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "getFunctionTables")) Module2["getFunctionTables"] = function() {
      abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "alignFunctionTables")) Module2["alignFunctionTables"] = function() {
      abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "registerFunctions")) Module2["registerFunctions"] = function() {
      abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "addFunction")) Module2["addFunction"] = function() {
      abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "removeFunction")) Module2["removeFunction"] = function() {
      abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "getFuncWrapper")) Module2["getFuncWrapper"] = function() {
      abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "prettyPrint")) Module2["prettyPrint"] = function() {
      abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "makeBigInt")) Module2["makeBigInt"] = function() {
      abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "dynCall")) Module2["dynCall"] = function() {
      abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "getCompilerSetting")) Module2["getCompilerSetting"] = function() {
      abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "stackSave")) Module2["stackSave"] = function() {
      abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "stackRestore")) Module2["stackRestore"] = function() {
      abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "stackAlloc")) Module2["stackAlloc"] = function() {
      abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "establishStackSpace")) Module2["establishStackSpace"] = function() {
      abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "print")) Module2["print"] = function() {
      abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "printErr")) Module2["printErr"] = function() {
      abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "getTempRet0")) Module2["getTempRet0"] = function() {
      abort("'getTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "setTempRet0")) Module2["setTempRet0"] = function() {
      abort("'setTempRet0' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "callMain")) Module2["callMain"] = function() {
      abort("'callMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "Pointer_stringify")) Module2["Pointer_stringify"] = function() {
      abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "warnOnce")) Module2["warnOnce"] = function() {
      abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "writeStackCookie")) Module2["writeStackCookie"] = function() {
      abort("'writeStackCookie' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "checkStackCookie")) Module2["checkStackCookie"] = function() {
      abort("'checkStackCookie' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "abortStackOverflow")) Module2["abortStackOverflow"] = function() {
      abort("'abortStackOverflow' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "intArrayFromBase64")) Module2["intArrayFromBase64"] = function() {
      abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "tryParseAsDataURI")) Module2["tryParseAsDataURI"] = function() {
      abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    };
    if (!Object.getOwnPropertyDescriptor(Module2, "ALLOC_NORMAL")) Object.defineProperty(Module2, "ALLOC_NORMAL", { get: function() {
      abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    } });
    if (!Object.getOwnPropertyDescriptor(Module2, "ALLOC_STACK")) Object.defineProperty(Module2, "ALLOC_STACK", { get: function() {
      abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    } });
    if (!Object.getOwnPropertyDescriptor(Module2, "ALLOC_DYNAMIC")) Object.defineProperty(Module2, "ALLOC_DYNAMIC", { get: function() {
      abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    } });
    if (!Object.getOwnPropertyDescriptor(Module2, "ALLOC_NONE")) Object.defineProperty(Module2, "ALLOC_NONE", { get: function() {
      abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)");
    } });
    if (!Object.getOwnPropertyDescriptor(Module2, "calledRun")) Object.defineProperty(Module2, "calledRun", { get: function() {
      abort("'calledRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you");
    } });
    var calledRun;
    Module2["then"] = function(func) {
      if (calledRun) {
        func(Module2);
      } else {
        var old = Module2["onRuntimeInitialized"];
        Module2["onRuntimeInitialized"] = function() {
          if (old) old();
          func(Module2);
        };
      }
      return Module2;
    };
    dependenciesFulfilled = function runCaller() {
      if (!calledRun) run();
      if (!calledRun) dependenciesFulfilled = runCaller;
    };
    function run(args) {
      if (runDependencies > 0) {
        return;
      }
      writeStackCookie();
      preRun();
      if (runDependencies > 0) return;
      function doRun() {
        if (calledRun) return;
        calledRun = true;
        if (ABORT) return;
        initRuntime();
        preMain();
        if (Module2["onRuntimeInitialized"]) Module2["onRuntimeInitialized"]();
        assert(!Module2["_main"], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');
        postRun();
      }
      if (Module2["setStatus"]) {
        Module2["setStatus"]("Running...");
        setTimeout(function() {
          setTimeout(function() {
            Module2["setStatus"]("");
          }, 1);
          doRun();
        }, 1);
      } else {
        doRun();
      }
      checkStackCookie();
    }
    Module2["run"] = run;
    var abortDecorators = [];
    function abort(what) {
      if (Module2["onAbort"]) {
        Module2["onAbort"](what);
      }
      what += "";
      out(what);
      err(what);
      ABORT = true;
      var extra = "";
      var output = "abort(" + what + ") at " + stackTrace() + extra;
      if (abortDecorators) {
        abortDecorators.forEach(function(decorator) {
          output = decorator(output, what);
        });
      }
      throw output;
    }
    Module2["abort"] = abort;
    if (Module2["preInit"]) {
      if (typeof Module2["preInit"] == "function") Module2["preInit"] = [Module2["preInit"]];
      while (Module2["preInit"].length > 0) {
        Module2["preInit"].pop()();
      }
    }
    run();
    return Module2;
  });
})();

const OUTPUT_COLUMNS = 109;
const HIDDEN_UNITS = 208;
const RENAMED = { iw: "he", fil: "tl" };
async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("");
}
async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
function decodeTensor(d, count, arrays, shapes) {
  if (d.encoding === "raw") {
    const value = arrays[d.array];
    if (!value || value.length !== count || JSON.stringify(shapes[d.array]) !== JSON.stringify(d.shape)) {
      throw new Error("invalid raw tensor");
    }
    return value;
  }
  if (d.encoding === "int8-columns") {
    const cols = d.shape[1], quant = arrays[d.quant], scales = arrays[d.scales];
    if (d.shape.length !== 2 || !(quant instanceof Int8Array) || quant.length !== count || !(scales instanceof Float32Array) || scales.length !== cols) {
      throw new Error("invalid int8 tensor");
    }
    const value = new Float32Array(count);
    for (let i = 0; i < count; i++) value[i] = quant[i] * scales[i % cols];
    return value;
  }
  if (d.encoding === "pq4" || d.encoding === "pq8") {
    const [rows = 0, cols = 0] = d.shape;
    const groups = d.groups, centroids = d.centroids, books = arrays[d.books], codes = arrays[d.codes];
    const width = cols / groups;
    if (d.shape.length !== 2 || !Number.isInteger(groups) || groups < 1 || !Number.isInteger(width) || !(books instanceof Uint8Array) || !(codes instanceof Uint8Array) || books.length !== groups * centroids * width || (d.encoding === "pq4" ? centroids !== 16 : centroids !== 256) || codes.length !== Math.ceil(rows * groups / (centroids === 16 ? 2 : 1))) {
      throw new Error("invalid PQ tensor");
    }
    const value = new Uint8Array(count);
    for (let row = 0; row < rows; row++) {
      for (let group = 0; group < groups; group++) {
        const i = row * groups + group;
        const code = centroids === 16 ? codes[i >> 1] >> (i & 1) * 4 & 15 : codes[i];
        const offset = (group * centroids + code) * width;
        value.set(books.subarray(offset, offset + width), row * cols + group * width);
      }
    }
    return value;
  }
  throw new Error("unsupported tensor encoding");
}
async function reconstructCld3(input, coreGzip) {
  const { meta: m, arrays, shapes } = parseContainer(input);
  if (m.architecture !== "cld3-wasm-pack" || m.wasm_bytes !== CLD3_LAYOUT.wasm_bytes || m.source_wasm_sha256 !== CLD3_LAYOUT.source_wasm_sha256) {
    throw new Error("unsupported CLD3 pack");
  }
  if (!Array.isArray(m.labels) || !m.labels.length || new Set(m.labels).size !== m.labels.length || !Array.isArray(m.output_columns) || m.output_columns.length !== m.labels.length || new Set(m.output_columns).size !== m.output_columns.length || m.output_columns.some((x) => !Number.isInteger(x) || x < 0 || x >= OUTPUT_COLUMNS)) {
    throw new Error("invalid output columns");
  }
  if (m.output_columns.some((column, i) => CLD3_LAYOUT.labels[column] !== m.labels[i])) throw new Error("label/column mismatch");
  if (JSON.stringify(m.ranges) !== JSON.stringify(CLD3_LAYOUT.ranges) || m.core_sha256 !== CLD3_LAYOUT.core_sha256 || m.core_gzip_sha256 !== CLD3_LAYOUT.core_gzip_sha256 || m.core_bytes !== CLD3_LAYOUT.core_bytes) {
    throw new Error("pack does not match pinned runtime layout");
  }
  const zipped = toBytes(coreGzip);
  if (await sha256Hex(zipped) !== m.core_gzip_sha256) throw new Error("CLD3 core gzip hash mismatch");
  const core = await gunzip(zipped);
  if (core.length !== m.core_bytes || await sha256Hex(core) !== m.core_sha256) throw new Error("CLD3 core hash mismatch");
  const wasm = new Uint8Array(m.wasm_bytes);
  let written = 0, consumed = 0;
  if (!Array.isArray(m.ranges) || m.ranges.length !== 16) throw new Error("invalid parameter ranges");
  for (const range of m.ranges) {
    if (!Number.isSafeInteger(range.offset) || !Number.isSafeInteger(range.bytes) || range.offset < written || range.bytes < 1 || range.offset + range.bytes > wasm.length) {
      throw new Error("invalid parameter range");
    }
    const d = m.tensors[range.name];
    if (!d || d.target !== range.name || !Array.isArray(d.shape) || d.shape.some((x) => !Number.isSafeInteger(x) || x < 1)) {
      throw new Error("invalid tensor descriptor");
    }
    const count = d.shape.reduce((x, y) => x * y, 1);
    if (!Number.isSafeInteger(count) || count > 1e6) throw new Error("invalid tensor size");
    let value = decodeTensor(d, count, arrays, shapes);
    if (value instanceof Float32Array && value.some((x) => !Number.isFinite(x))) throw new Error("non-finite tensor");
    if (d.scatter === "columns") {
      if (d.shape[0] !== HIDDEN_UNITS || d.shape[1] !== m.output_columns.length || !(value instanceof Float32Array)) {
        throw new Error("invalid classifier");
      }
      const full = new Float32Array(HIDDEN_UNITS * OUTPUT_COLUMNS), stored = value;
      for (let row = 0; row < HIDDEN_UNITS; row++) {
        m.output_columns.forEach((column, j) => {
          full[row * OUTPUT_COLUMNS + column] = stored[row * m.output_columns.length + j];
        });
      }
      value = full;
    } else if (d.scatter === "bias") {
      if (value.length !== m.output_columns.length || !(value instanceof Float32Array)) throw new Error("invalid classifier bias");
      const full = new Float32Array(OUTPUT_COLUMNS).fill(-1e9), stored = value;
      m.output_columns.forEach((column, j) => {
        full[column] = stored[j];
      });
      value = full;
    }
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (bytes.length !== range.bytes) throw new Error("tensor byte size mismatch");
    const gap = range.offset - written;
    if (consumed + gap > core.length) throw new Error("truncated core");
    wasm.set(core.subarray(consumed, consumed + gap), written);
    consumed += gap;
    wasm.set(bytes, range.offset);
    written = range.offset + range.bytes;
  }
  if (core.length - consumed !== wasm.length - written) throw new Error("core layout mismatch");
  wasm.set(core.subarray(consumed), written);
  if (m.method === "raw" && m.labels.length === OUTPUT_COLUMNS && await sha256Hex(wasm) !== m.source_wasm_sha256) {
    throw new Error("lossless reconstruction failed");
  }
  return { wasm, meta: m };
}
async function createCld3Pack(input, { core, minBytes = 0, maxBytes = 1e4 } = {}) {
  if (!core) throw new Error("core gzip bytes required");
  if (!Number.isInteger(minBytes) || !Number.isInteger(maxBytes) || minBytes < 0 || maxBytes <= minBytes) {
    throw new RangeError("0 <= minBytes < maxBytes required");
  }
  const { wasm, meta } = await reconstructCld3(input, core);
  const { module } = await new Promise((resolve, reject) => {
    const instance = Module({
      wasmBinary: wasm,
      onRuntimeInitialized() {
        resolve({ module: instance });
      },
      onAbort: reject
    });
  });
  const create = module.cwrap("Cld_create", "number", ["number", "number"]);
  const destroy = module.cwrap("Cld_destroy", null, ["number"]);
  const infer = module.cwrap("Cld_findLanguage", null, ["number", "number", "number"]);
  const resultSize = module.cwrap("get_SizeLanguageResult", "number", [])();
  const pointer = create(minBytes, maxBytes);
  let disposed = false;
  return {
    meta,
    predict(text, { k = 1, threshold = 0, languages, boost } = {}) {
      if (disposed) throw new Error("CLD3 provider has been disposed");
      if (typeof text !== "string") throw new TypeError("text must be a string");
      if (k !== 1 || languages !== void 0) throw new RangeError("CLD3 pack supports top-1; use a build-time language allowlist");
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new RangeError("threshold must be in [0,1]");
      const weight = boostWeight(boost);
      for (const char of text) {
        const cp = char.codePointAt(0);
        if (cp >= 55296 && cp <= 57343) throw new TypeError("unpaired Unicode surrogate");
      }
      if (!text.trim()) return [];
      const input2 = module.allocateUTF8(text), result = module._malloc(resultSize);
      let languagePointer = 0, ranges = 0, rangeCount = 0;
      try {
        infer(pointer, input2, result);
        languagePointer = module.getValue(result, "*");
        const raw = module.UTF8ToString(languagePointer), language = RENAMED[raw] ?? raw;
        const score = module.getValue(result + 4, "float"), reliable = Boolean(module.getValue(result + 8, "i8"));
        rangeCount = module.getValue(result + 16, "i32");
        ranges = module.getValue(result + 20, "*");
        if (language === "und" || !language) return [];
        if (!meta.labels.includes(language)) throw new Error("native result escaped model allowlist");
        const checked = checkTop1(text, meta.labels, { language, score, reliable }, weight);
        return checked.score < threshold ? [] : [checked];
      } finally {
        for (let i = 0; i < rangeCount; i++) module._free(module.getValue(ranges + i * 4, "*"));
        if (ranges) module._free(ranges);
        if (languagePointer) module._free(languagePointer);
        module._free(result);
        module._free(input2);
      }
    },
    dispose() {
      if (!disposed) {
        destroy(pointer);
        disposed = true;
      }
    }
  };
}
async function loadCld3Pack(url, { coreURL = new URL("../runtime/cld3-core.bin.gz", import.meta.url), ...options } = {}) {
  const [model, core] = await Promise.all([fetchBytes(url), fetchBytes(coreURL)]);
  return createCld3Pack(model, { ...options, core });
}

export { createCld3Pack, loadCld3Pack, reconstructCld3 };
