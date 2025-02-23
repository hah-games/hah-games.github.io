var UnityLoader = UnityLoader || {
    compatibilityCheck: function (e, t, r) {
        UnityLoader.SystemInfo.hasWebGL
            ? UnityLoader.SystemInfo.mobile
                ? e.popup("Please note that Unity WebGL is not currently supported on mobiles. Press OK if you wish to continue anyway.", [{ text: "OK", callback: t }])
                : ["Edge", "Firefox", "Chrome", "Safari"].indexOf(UnityLoader.SystemInfo.browser) == -1
                ? e.popup("Please note that your browser is not currently supported for this Unity WebGL content. Press OK if you wish to continue anyway.", [{ text: "OK", callback: t }])
                : t()
            : e.popup("Your browser does not support WebGL", [{ text: "OK", callback: r }]);
    },
    Blobs: {},
    loadCode: function (e, t, r) {
        var n = [].slice
                .call(UnityLoader.Cryptography.md5(e))
                .map(function (e) {
                    return ("0" + e.toString(16)).substr(-2);
                })
                .join(""),
            o = document.createElement("script"),
            a = URL.createObjectURL(new Blob(['UnityLoader["' + n + '"]=', e], { type: "text/javascript" }));
        (UnityLoader.Blobs[a] = r),
            (o.src = a),
            (o.onload = function () {
                URL.revokeObjectURL(a), t(n);
            }),
            document.body.appendChild(o);
    },
    allocateHeapJob: function (e, t) {
        for (var r = e.TOTAL_STACK || 5242880, n = e.TOTAL_MEMORY || (e.buffer ? e.buffer.byteLength : 268435456), o = 65536, a = 16777216, i = o; i < n || i < 2 * r; ) i += i < a ? i : a;
        i != n && e.printErr("increasing TOTAL_MEMORY to " + i + " to be compliant with the asm.js spec (and given that TOTAL_STACK=" + r + ")"),
            (n = i),
            t.parameters.useWasm
                ? ((e.wasmMemory = new WebAssembly.Memory({ initial: n / o, maximum: n / o })), (e.buffer = e.wasmMemory.buffer))
                : e.buffer
                ? e.buffer.byteLength != n && (e.printErr("provided buffer should be " + n + " bytes, but it is " + e.buffer.byteLength + ", reallocating the buffer"), (e.buffer = new ArrayBuffer(n)))
                : (e.buffer = new ArrayBuffer(n)),
            (e.TOTAL_MEMORY = e.buffer.byteLength),
            t.complete();
    },
    setupIndexedDBJob: function (e, t) {
        function r(n) {
            r.called || ((r.called = !0), (e.indexedDB = n), t.complete());
        }
        try {
            var n = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
                o = n.open("/idbfs-test");
            (o.onerror = function (e) {
                e.preventDefault(), r();
            }),
                (o.onsuccess = function () {
                    o.result.close(), r(n);
                }),
                setTimeout(r, 1e3);
        } catch (e) {
            r();
        }
    },
    processWasmCodeJob: function (e, t) {
        (e.wasmBinary = UnityLoader.Job.result(e, "downloadWasmCode")), t.complete();
    },
    processWasmFrameworkJob: function (e, t) {
        UnityLoader.loadCode(
            UnityLoader.Job.result(e, "downloadWasmFramework"),
            function (r) {
                UnityLoader[r](e), t.complete();
            },
            { Module: e, url: e.wasmFrameworkUrl }
        );
    },
    processAsmCodeJob: function (e, t) {
        var r = UnityLoader.Job.result(e, "downloadAsmCode");
        UnityLoader.loadCode(
            Math.fround ? r : UnityLoader.Utils.optimizeMathFround(r),
            function (r) {
                (e.asm = UnityLoader[r]), t.complete();
            },
            { Module: e, url: e.asmCodeUrl }
        );
    },
    processAsmFrameworkJob: function (e, t) {
        UnityLoader.loadCode(
            UnityLoader.Job.result(e, "downloadAsmFramework"),
            function (r) {
                UnityLoader[r](e), t.complete();
            },
            { Module: e, url: e.asmFrameworkUrl }
        );
    },
    processAsmMemoryJob: function (e, t) {
        (e.memoryInitializerRequest.status = 200), (e.memoryInitializerRequest.response = UnityLoader.Job.result(e, "downloadAsmMemory")), e.memoryInitializerRequest.callback && e.memoryInitializerRequest.callback(), t.complete();
    },
    processDataJob: function (e, t) {
        var r = UnityLoader.Job.result(e, "downloadData"),
            n = new DataView(r.buffer, r.byteOffset, r.byteLength),
            o = 0,
            a = "UnityWebData1.0\0";
        if (!String.fromCharCode.apply(null, r.subarray(o, o + a.length)) == a) throw "unknown data format";
        o += a.length;
        var i = n.getUint32(o, !0);
        for (o += 4; o < i; ) {
            var s = n.getUint32(o, !0);
            o += 4;
            var d = n.getUint32(o, !0);
            o += 4;
            var l = n.getUint32(o, !0);
            o += 4;
            var u = String.fromCharCode.apply(null, r.subarray(o, o + l));
            o += l;
            for (var f = 0, c = u.indexOf("/", f) + 1; c > 0; f = c, c = u.indexOf("/", f) + 1) e.FS_createPath(u.substring(0, f), u.substring(f, c - 1), !0, !0);
            e.FS_createDataFile(u, null, r.subarray(s, s + d), !0, !0, !0);
        }
        e.removeRunDependency("processDataJob"), t.complete();
    },
    downloadJob: function (e, t) {
        var r = t.parameters.objParameters ? new UnityLoader.XMLHttpRequest(t.parameters.objParameters) : new XMLHttpRequest();
        r.open("GET", t.parameters.url),
            (r.responseType = "arraybuffer"),
            (r.onload = function () {
                UnityLoader.Compression.decompress(new Uint8Array(r.response), function (e) {
                    t.complete(e);
                });
            }),
            t.parameters.onprogress && r.addEventListener("progress", t.parameters.onprogress),
            t.parameters.onload && r.addEventListener("load", t.parameters.onload),
            r.send();
    },
    scheduleBuildDownloadJob: function (e, t, r) {
        UnityLoader.Progress.update(e, t),
            UnityLoader.Job.schedule(e, t, [], UnityLoader.downloadJob, {
                url: e.resolveBuildUrl(e[r]),
                onprogress: function (r) {
                    UnityLoader.Progress.update(e, t, r);
                },
                onload: function (r) {
                    UnityLoader.Progress.update(e, t, r);
                },
                objParameters: e.companyName && e.productName && e.cacheControl && e.cacheControl[r] ? { companyName: e.companyName, productName: e.productName, cacheControl: e.cacheControl[r] } : null,
            });
    },
    loadModule: function (e) {
        if (((e.useWasm = e.wasmCodeUrl && UnityLoader.SystemInfo.hasWasm), e.useWasm))
            UnityLoader.scheduleBuildDownloadJob(e, "downloadWasmCode", "wasmCodeUrl"),
                UnityLoader.Job.schedule(e, "processWasmCode", ["downloadWasmCode"], UnityLoader.processWasmCodeJob),
                UnityLoader.scheduleBuildDownloadJob(e, "downloadWasmFramework", "wasmFrameworkUrl"),
                UnityLoader.Job.schedule(e, "processWasmFramework", ["downloadWasmFramework", "processWasmCode", "setupIndexedDB"], UnityLoader.processWasmFrameworkJob);
        else {
            if (!e.asmCodeUrl) throw "WebAssembly support is not detected in this browser.";
            UnityLoader.scheduleBuildDownloadJob(e, "downloadAsmCode", "asmCodeUrl"),
                UnityLoader.Job.schedule(e, "processAsmCode", ["downloadAsmCode"], UnityLoader.processAsmCodeJob),
                UnityLoader.scheduleBuildDownloadJob(e, "downloadAsmMemory", "asmMemoryUrl"),
                UnityLoader.Job.schedule(e, "processAsmMemory", ["downloadAsmMemory"], UnityLoader.processAsmMemoryJob),
                (e.memoryInitializerRequest = {
                    addEventListener: function (t, r) {
                        e.memoryInitializerRequest.callback = r;
                    },
                }),
                e.asmLibraryUrl && (e.dynamicLibraries = [e.asmLibraryUrl].map(e.resolveBuildUrl)),
                UnityLoader.scheduleBuildDownloadJob(e, "downloadAsmFramework", "asmFrameworkUrl"),
                UnityLoader.Job.schedule(e, "processAsmFramework", ["downloadAsmFramework", "processAsmCode", "setupIndexedDB"], UnityLoader.processAsmFrameworkJob);
        }
        UnityLoader.scheduleBuildDownloadJob(e, "downloadData", "dataUrl"),
            UnityLoader.Job.schedule(e, "setupIndexedDB", [], UnityLoader.setupIndexedDBJob),
            e.preRun.push(function () {
                e.addRunDependency("processDataJob"), UnityLoader.Job.schedule(e, "processData", ["downloadData"], UnityLoader.processDataJob);
            });
    },
    instantiate: function (e, t, r) {
        function n(e, r) {
            if ("string" == typeof e && !(e = document.getElementById(e))) return !1;
            (e.innerHTML = ""),
                (e.style.border = e.style.margin = e.style.padding = 0),
                "static" == getComputedStyle(e).getPropertyValue("position") && (e.style.position = "relative"),
                (e.style.width = r.width || e.style.width),
                (e.style.height = r.height || e.style.height),
                (r.container = e);
            var n = r.Module;
            return (
                (n.canvas = document.createElement("canvas")),
                (n.canvas.style.width = "100%"),
                (n.canvas.style.height = "100%"),
                n.canvas.addEventListener("contextmenu", function (e) {
                    e.preventDefault();
                }),
                (n.canvas.id = "#canvas"),
                e.appendChild(n.canvas),
                r.compatibilityCheck(
                    r,
                    function () {
                        var t = new XMLHttpRequest();
                        t.open("GET", r.url, !0),
                            (t.responseType = "text"),
                            (t.onerror = function () {
                                n.print("Could not download " + r.url),
                                    0 == document.URL.indexOf("file:") && alert("It seems your browser does not support running Unity WebGL content from file:// urls. Please upload it to an http server, or try a different browser.");
                            }),
                            (t.onload = function () {
                                var o = JSON.parse(t.responseText);
                                for (var a in o) "undefined" == typeof n[a] && (n[a] = o[a]);
                                for (var i = !1, s = 0; s < n.graphicsAPI.length; s++) {
                                    var d = n.graphicsAPI[s];
                                    "WebGL 2.0" == d && 2 == UnityLoader.SystemInfo.hasWebGL ? (i = !0) : "WebGL 1.0" == d && UnityLoader.SystemInfo.hasWebGL >= 1 ? (i = !0) : n.print("Warning: Unsupported graphics API " + d);
                                }
                                return i
                                    ? ((e.style.background = n.backgroundUrl ? "center/cover url('" + n.resolveBuildUrl(n.backgroundUrl) + "')" : n.backgroundColor ? " " + n.backgroundColor : ""),
                                      r.onProgress(r, 0),
                                      void UnityLoader.loadModule(n))
                                    : void r.popup("Your browser does not support any of the required graphics API for this content: " + n.graphicsAPI, [{ text: "OK" }]);
                            }),
                            t.send();
                    },
                    function () {
                        n.print("Instantiation of the '" + t + "' terminated due to the failed compatibility check.");
                    }
                ),
                !0
            );
        }
        var o = {
            url: t,
            onProgress: UnityLoader.Progress.handler,
            compatibilityCheck: UnityLoader.compatibilityCheck,
            Module: {
                preRun: [],
                postRun: [],
                print: function (e) {
                    console.log(e);
                },
                printErr: function (e) {
                    console.error(e);
                },
                Jobs: {},
                buildDownloadProgress: {},
                resolveBuildUrl: function (e) {
                    return e.match(/(http|https|ftp|file):\/\//) ? e : t.substring(0, t.lastIndexOf("/") + 1) + e;
                },
            },
            SetFullscreen: function () {
                if (o.Module.SetFullscreen) return o.Module.SetFullscreen.apply(o.Module, arguments);
            },
            SendMessage: function () {
                if (o.Module.SendMessage) return o.Module.SendMessage.apply(o.Module, arguments);
            },
        };
        (o.Module.gameInstance = o),
            (o.popup = function (e, t) {
                return UnityLoader.Error.popup(o, e, t);
            }),
            o.Module.postRun.push(function () {
                o.onProgress(o, 1);
            });
        for (var a in r)
            if ("Module" == a) for (var i in r[a]) o.Module[i] = r[a][i];
            else o[a] = r[a];
        return (
            n(e, o) ||
                document.addEventListener("DOMContentLoaded", function () {
                    n(e, o);
                }),
            o
        );
    },
    SystemInfo: (function () {
        var e,
            t,
            r,
            n = "-",
            o = navigator.appVersion,
            a = navigator.userAgent,
            i = navigator.appName,
            s = navigator.appVersion,
            d = parseInt(navigator.appVersion, 10);
        (t = a.indexOf("Opera")) != -1
            ? ((i = "Opera"), (s = a.substring(t + 6)), (t = a.indexOf("Version")) != -1 && (s = a.substring(t + 8)))
            : (t = a.indexOf("MSIE")) != -1
            ? ((i = "Microsoft Internet Explorer"), (s = a.substring(t + 5)))
            : (t = a.indexOf("Edge")) != -1
            ? ((i = "Edge"), (s = a.substring(t + 5)))
            : (t = a.indexOf("Chrome")) != -1
            ? ((i = "Chrome"), (s = a.substring(t + 7)))
            : (t = a.indexOf("Safari")) != -1
            ? ((i = "Safari"), (s = a.substring(t + 7)), (t = a.indexOf("Version")) != -1 && (s = a.substring(t + 8)))
            : (t = a.indexOf("Firefox")) != -1
            ? ((i = "Firefox"), (s = a.substring(t + 8)))
            : a.indexOf("Trident/") != -1
            ? ((i = "Microsoft Internet Explorer"), (s = a.substring(a.indexOf("rv:") + 3)))
            : (e = a.lastIndexOf(" ") + 1) < (t = a.lastIndexOf("/")) && ((i = a.substring(e, t)), (s = a.substring(t + 1)), i.toLowerCase() == i.toUpperCase() && (i = navigator.appName)),
            (r = s.indexOf(";")) != -1 && (s = s.substring(0, r)),
            (r = s.indexOf(" ")) != -1 && (s = s.substring(0, r)),
            (r = s.indexOf(")")) != -1 && (s = s.substring(0, r)),
            (d = parseInt("" + s, 10)),
            isNaN(d) ? ((s = "" + parseFloat(navigator.appVersion)), (d = parseInt(navigator.appVersion, 10))) : (s = "" + parseFloat(s));
        var l = /Mobile|mini|Fennec|Android|iP(ad|od|hone)/.test(o),
            u = n,
            f = [
                { s: "Windows 3.11", r: /Win16/ },
                { s: "Windows 95", r: /(Windows 95|Win95|Windows_95)/ },
                { s: "Windows ME", r: /(Win 9x 4.90|Windows ME)/ },
                { s: "Windows 98", r: /(Windows 98|Win98)/ },
                { s: "Windows CE", r: /Windows CE/ },
                { s: "Windows 2000", r: /(Windows NT 5.0|Windows 2000)/ },
                { s: "Windows XP", r: /(Windows NT 5.1|Windows XP)/ },
                { s: "Windows Server 2003", r: /Windows NT 5.2/ },
                { s: "Windows Vista", r: /Windows NT 6.0/ },
                { s: "Windows 7", r: /(Windows 7|Windows NT 6.1)/ },
                { s: "Windows 8.1", r: /(Windows 8.1|Windows NT 6.3)/ },
                { s: "Windows 8", r: /(Windows 8|Windows NT 6.2)/ },
                { s: "Windows 10", r: /(Windows 10|Windows NT 10.0)/ },
                { s: "Windows NT 4.0", r: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/ },
                { s: "Windows ME", r: /Windows ME/ },
                { s: "Android", r: /Android/ },
                { s: "Open BSD", r: /OpenBSD/ },
                { s: "Sun OS", r: /SunOS/ },
                { s: "Linux", r: /(Linux|X11)/ },
                { s: "iOS", r: /(iPhone|iPad|iPod)/ },
                { s: "Mac OS X", r: /Mac OS X/ },
                { s: "Mac OS", r: /(MacPPC|MacIntel|Mac_PowerPC|Macintosh)/ },
                { s: "QNX", r: /QNX/ },
                { s: "UNIX", r: /UNIX/ },
                { s: "BeOS", r: /BeOS/ },
                { s: "OS/2", r: /OS\/2/ },
                { s: "Search Bot", r: /(nuhk|Googlebot|Yammybot|Openbot|Slurp|MSNBot|Ask Jeeves\/Teoma|ia_archiver)/ },
            ];
        for (var c in f) {
            var h = f[c];
            if (h.r.test(a)) {
                u = h.s;
                break;
            }
        }
        var p = n;
        switch ((/Windows/.test(u) && ((p = /Windows (.*)/.exec(u)[1]), (u = "Windows")), u)) {
            case "Mac OS X":
                p = /Mac OS X (10[\.\_\d]+)/.exec(a)[1];
                break;
            case "Android":
                p = /Android ([\.\_\d]+)/.exec(a)[1];
                break;
            case "iOS":
                (p = /OS (\d+)_(\d+)_?(\d+)?/.exec(o)), (p = p[1] + "." + p[2] + "." + (0 | p[3]));
        }
        return {
            width: screen.width ? screen.width : 0,
            height: screen.height ? screen.height : 0,
            browser: i,
            browserVersion: s,
            mobile: l,
            os: u,
            osVersion: p,
            gpu: (function () {
                var e = document.createElement("canvas"),
                    t = e.getContext("experimental-webgl");
                if (t) {
                    var r = t.getExtension("WEBGL_debug_renderer_info");
                    if (r) return t.getParameter(r.UNMASKED_RENDERER_WEBGL);
                }
                return n;
            })(),
            language: window.navigator.userLanguage || window.navigator.language,
            hasWebGL: (function () {
                if (!window.WebGLRenderingContext) return 0;
                var e = document.createElement("canvas"),
                    t = e.getContext("webgl2");
                return t ? 2 : ((t = e.getContext("experimental-webgl2")), t ? 2 : ((t = e.getContext("webgl")), t || (t = e.getContext("experimental-webgl")) ? 1 : 0));
            })(),
            hasCursorLock: (function () {
                var e = document.createElement("canvas");
                return e.requestPointerLock || e.mozRequestPointerLock || e.webkitRequestPointerLock || e.msRequestPointerLock ? 1 : 0;
            })(),
            hasFullscreen: (function () {
                var e = document.createElement("canvas");
                return (e.requestFullScreen || e.mozRequestFullScreen || e.msRequestFullscreen || e.webkitRequestFullScreen) && (i.indexOf("Safari") == -1 || s >= 10.1) ? 1 : 0;
            })(),
            hasWasm: "object" == typeof WebAssembly && "function" == typeof WebAssembly.validate && "function" == typeof WebAssembly.compile,
        };
    })(),
    Error: {
        init: (function () {
            return (
                (Error.stackTraceLimit = 50),
                window.addEventListener("error", function (e) {
                    var t = UnityLoader.Error.getModule(e);
                    if (!t) return UnityLoader.Error.handler(e);
                    var r = t.useWasm ? t.wasmSymbolsUrl : t.asmSymbolsUrl;
                    if (!r) return UnityLoader.Error.handler(e, t);
                    var n = new XMLHttpRequest();
                    n.open("GET", t.resolveBuildUrl(r)),
                        (n.responseType = "arraybuffer"),
                        (n.onload = function () {
                            UnityLoader.loadCode(UnityLoader.Compression.decompress(new Uint8Array(n.response)), function (r) {
                                (t.demangleSymbol = UnityLoader[r]()), UnityLoader.Error.handler(e, t);
                            });
                        }),
                        n.send();
                }),
                !0
            );
        })(),
        stackTraceFormat:
            navigator.userAgent.indexOf("Chrome") != -1
                ? "(\\s+at\\s+)(([\\w\\d_\\.]*?)([\\w\\d_$]+)(/[\\w\\d_\\./]+|))(\\s+\\[.*\\]|)\\s*\\((blob:.*)\\)"
                : "(\\s*)(([\\w\\d_\\.]*?)([\\w\\d_$]+)(/[\\w\\d_\\./]+|))(\\s+\\[.*\\]|)\\s*@(blob:.*)",
        stackTraceFormatWasm: navigator.userAgent.indexOf("Chrome") != -1 ? "((\\s+at\\s*)\\s\\(<WASM>\\[(\\d+)\\]\\+\\d+\\))()" : "((\\s*)wasm-function\\[(\\d+)\\])@(blob:.*)",
        blobParseRegExp: new RegExp("^(blob:.*)(:\\d+:\\d+)$"),
        getModule: function (e) {
            var t = e.message.match(new RegExp(this.stackTraceFormat, "g"));
            for (var r in t) {
                var n = t[r].match(new RegExp("^" + this.stackTraceFormat + "$")),
                    o = n[7].match(this.blobParseRegExp);
                if (o && UnityLoader.Blobs[o[1]] && UnityLoader.Blobs[o[1]].Module) return UnityLoader.Blobs[o[1]].Module;
            }
        },
        demangle: function (e, t) {
            var r = e.message;
            return t
                ? ((r = r.replace(
                      new RegExp(this.stackTraceFormat, "g"),
                      function (e) {
                          var r = e.match(new RegExp("^" + this.stackTraceFormat + "$")),
                              n = r[7].match(this.blobParseRegExp),
                              o = t.demangleSymbol ? t.demangleSymbol(r[4]) : r[4],
                              a = n && UnityLoader.Blobs[n[1]] && UnityLoader.Blobs[n[1]].url ? UnityLoader.Blobs[n[1]].url : "blob";
                          return r[1] + o + (r[2] != o ? " [" + r[2] + "]" : "") + " (" + (n ? a.substr(a.lastIndexOf("/") + 1) + n[2] : r[7]) + ")";
                      }.bind(this)
                  )),
                  t.useWasm &&
                      (r = r.replace(
                          new RegExp(this.stackTraceFormatWasm, "g"),
                          function (e) {
                              var r = e.match(new RegExp("^" + this.stackTraceFormatWasm + "$")),
                                  n = t.demangleSymbol ? t.demangleSymbol(r[3]) : r[3],
                                  o = r[4].match(this.blobParseRegExp),
                                  a = o && UnityLoader.Blobs[o[1]] && UnityLoader.Blobs[o[1]].url ? UnityLoader.Blobs[o[1]].url : "blob";
                              return (n == r[3] ? r[1] : r[2] + n + " [wasm:" + r[3] + "]") + (r[4] ? " (" + (o ? a.substr(a.lastIndexOf("/") + 1) + o[2] : r[4]) + ")" : "");
                          }.bind(this)
                      )),
                  r)
                : r;
        },
        handler: function (e, t) {
            var r = t ? this.demangle(e, t) : e.message;
            if (
                !(
                    (t && t.errorhandler && t.errorhandler(r, e.filename, e.lineno)) ||
                    (console.log("Invoking error handler due to\n" + r),
                    "function" == typeof dump && dump("Invoking error handler due to\n" + r),
                    r.indexOf("UnknownError") != -1 || r.indexOf("Program terminated with exit(0)") != -1 || this.didShowErrorMessage)
                )
            ) {
                var r = "An error occurred running the Unity content on this page. See your browser JavaScript console for more info. The error was:\n" + r;
                r.indexOf("DISABLE_EXCEPTION_CATCHING") != -1
                    ? (r =
                          "An exception has occurred, but exception handling has been disabled in this build. If you are the developer of this content, enable exceptions in your project WebGL player settings to be able to catch the exception or see the stack trace.")
                    : r.indexOf("Cannot enlarge memory arrays") != -1
                    ? (r = "Out of memory. If you are the developer of this content, try allocating more memory to your WebGL build in the WebGL player settings.")
                    : (r.indexOf("Invalid array buffer length") == -1 && r.indexOf("Invalid typed array length") == -1 && r.indexOf("out of memory") == -1) ||
                      (r = "The browser could not allocate enough memory for the WebGL content. If you are the developer of this content, try allocating less memory to your WebGL build in the WebGL player settings."),
                    alert(r),
                    (this.didShowErrorMessage = !0);
            }
        },
        popup: function (e, t, r) {
            r = r || [{ text: "OK" }];
            var n = document.createElement("div");
            n.style.cssText = "position: absolute; top: 50%; left: 50%; -webkit-transform: translate(-50%, -50%); transform: translate(-50%, -50%); text-align: center; border: 1px solid black; padding: 5px; background: #E8E8E8";
            var o = document.createElement("span");
            (o.textContent = t), n.appendChild(o), n.appendChild(document.createElement("br"));
            for (var a = 0; a < r.length; a++) {
                var i = document.createElement("button");
                r[a].text && (i.textContent = r[a].text),
                    r[a].callback && (i.onclick = r[a].callback),
                    (i.style.margin = "5px"),
                    i.addEventListener("click", function () {
                        e.container.removeChild(n);
                    }),
                    n.appendChild(i);
            }
            e.container.appendChild(n);
        },
    },
    Job: {
        schedule: function (e, t, r, n, o) {
            o = o || {};
            var a = e.Jobs[t];
            if ((a || (a = e.Jobs[t] = { dependencies: {}, dependants: {} }), a.callback)) throw "[UnityLoader.Job.schedule] job '" + t + "' has been already scheduled";
            if ("function" != typeof n) throw "[UnityLoader.Job.schedule] job '" + t + "' has invalid callback";
            if ("object" != typeof o) throw "[UnityLoader.Job.schedule] job '" + t + "' has invalid parameters";
            (a.callback = function (e, t) {
                (a.starttime = performance.now()), n(e, t);
            }),
                (a.parameters = o),
                (a.complete = function (r) {
                    (a.endtime = performance.now()), (a.result = { value: r });
                    for (var n in a.dependants) {
                        var o = e.Jobs[n];
                        o.dependencies[t] = a.dependants[n] = !1;
                        var i = "function" != typeof o.callback;
                        for (var s in o.dependencies) i = i || o.dependencies[s];
                        if (!i) {
                            if (o.executed) throw "[UnityLoader.Job.schedule] job '" + t + "' has already been executed";
                            (o.executed = !0), setTimeout(o.callback.bind(null, e, o), 0);
                        }
                    }
                });
            var i = !1;
            r.forEach(function (r) {
                var n = e.Jobs[r];
                n || (n = e.Jobs[r] = { dependencies: {}, dependants: {} }), (a.dependencies[r] = n.dependants[t] = !n.result) && (i = !0);
            }),
                i || ((a.executed = !0), setTimeout(a.callback.bind(null, e, a), 0));
        },
        result: function (e, t) {
            var r = e.Jobs[t];
            if (!r) throw "[UnityLoader.Job.result] job '" + t + "' does not exist";
            if ("object" != typeof r.result) throw "[UnityLoader.Job.result] job '" + t + "' has invalid result";
            return r.result.value;
        },
    },
    XMLHttpRequest: (function () {
        function e(e) {
            console.log("[UnityCache] " + e);
        }
        function t(e) {
            return (t.link = t.link || document.createElement("a")), (t.link.href = e), t.link.href;
        }
        function r(e) {
            var t = window.location.href.match(/^[a-z]+:\/\/[^\/]+/);
            return !t || e.lastIndexOf(t[0], 0);
        }
        function n() {
            function t(t) {
                if ("undefined" == typeof r.database)
                    for (r.database = t, r.database || e("indexedDB database could not be opened"); r.queue.length; ) {
                        var n = r.queue.shift();
                        r.database ? r.execute.apply(r, n) : "function" == typeof n.onerror && n.onerror(new Error("operation cancelled"));
                    }
            }
            var r = this;
            r.queue = [];
            try {
                var n = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB,
                    o = n.open(i);
                (o.onupgradeneeded = function (e) {
                    var t = e.target.result.createObjectStore(s, { keyPath: "url" });
                    ["version", "company", "product", "updated", "revalidated", "accessed"].forEach(function (e) {
                        t.createIndex(e, e);
                    });
                }),
                    (o.onsuccess = function (e) {
                        t(e.target.result);
                    }),
                    (o.onerror = function () {
                        t(null);
                    }),
                    setTimeout(o.onerror, 1e3);
            } catch (e) {
                t(null);
            }
        }
        function o(e, t, r, n, o) {
            var a = { url: e, version: d, company: t, product: r, updated: n, revalidated: n, accessed: n, responseHeaders: {}, xhr: {} };
            return (
                o &&
                    (["Last-Modified", "ETag"].forEach(function (e) {
                        a.responseHeaders[e] = o.getResponseHeader(e);
                    }),
                    ["responseURL", "status", "statusText", "response"].forEach(function (e) {
                        a.xhr[e] = o[e];
                    })),
                a
            );
        }
        function a(t) {
            (this.cache = { enabled: !1 }),
                t && ((this.cache.control = t.cacheControl), (this.cache.company = t.companyName), (this.cache.product = t.productName)),
                (this.xhr = new XMLHttpRequest(t)),
                this.xhr.addEventListener(
                    "load",
                    function () {
                        var t = this.xhr,
                            r = this.cache;
                        r.enabled &&
                            !r.revalidated &&
                            (304 == t.status
                                ? ((r.result.revalidated = r.result.accessed), (r.revalidated = !0), l.execute("put", [r.result]), e("'" + r.result.url + "' successfully revalidated and served from the indexedDB cache"))
                                : 200 == t.status
                                ? ((r.result = o(r.result.url, r.company, r.product, r.result.accessed, t)),
                                  (r.revalidated = !0),
                                  l.execute(
                                      "put",
                                      [r.result],
                                      function (t) {
                                          e("'" + r.result.url + "' successfully downloaded and stored in the indexedDB cache");
                                      },
                                      function (t) {
                                          e("'" + r.result.url + "' successfully downloaded but not stored in the indexedDB cache due to the error: " + t);
                                      }
                                  ))
                                : e("'" + r.result.url + "' request failed with status: " + t.status + " " + t.statusText));
                    }.bind(this)
                );
        }
        var i = "UnityCache",
            s = "XMLHttpRequest",
            d = 1;
        n.prototype.execute = function (e, t, r, n) {
            if (this.database)
                try {
                    var o = this.database.transaction([s], ["put", "delete", "clear"].indexOf(e) != -1 ? "readwrite" : "readonly").objectStore(s);
                    "openKeyCursor" == e && ((o = o.index(t[0])), (t = t.slice(1)));
                    var a = o[e].apply(o, t);
                    "function" == typeof r &&
                        (a.onsuccess = function (e) {
                            r(e.target.result);
                        }),
                        (a.onerror = n);
                } catch (e) {
                    "function" == typeof n && n(e);
                }
            else "undefined" == typeof this.database ? this.queue.push(arguments) : "function" == typeof n && n(new Error("indexedDB access denied"));
        };
        var l = new n();
        (a.prototype.send = function (t) {
            var n = this.xhr,
                o = this.cache,
                a = arguments;
            return (
                (o.enabled = o.enabled && "arraybuffer" == n.responseType && !t),
                o.enabled
                    ? void l.execute(
                          "get",
                          [o.result.url],
                          function (t) {
                              if (!t || t.version != d) return void n.send.apply(n, a);
                              if (((o.result = t), (o.result.accessed = Date.now()), "immutable" == o.control))
                                  (o.revalidated = !0), l.execute("put", [o.result]), n.dispatchEvent(new Event("load")), e("'" + o.result.url + "' served from the indexedDB cache without revalidation");
                              else if (r(o.result.url) && (o.result.responseHeaders["Last-Modified"] || o.result.responseHeaders.ETag)) {
                                  var i = new XMLHttpRequest();
                                  i.open("HEAD", o.result.url),
                                      (i.onload = function () {
                                          (o.revalidated = ["Last-Modified", "ETag"].every(function (e) {
                                              return !o.result.responseHeaders[e] || o.result.responseHeaders[e] == i.getResponseHeader(e);
                                          })),
                                              o.revalidated
                                                  ? ((o.result.revalidated = o.result.accessed),
                                                    l.execute("put", [o.result]),
                                                    n.dispatchEvent(new Event("load")),
                                                    e("'" + o.result.url + "' successfully revalidated and served from the indexedDB cache"))
                                                  : n.send.apply(n, a);
                                      }),
                                      i.send();
                              } else
                                  o.result.responseHeaders["Last-Modified"]
                                      ? (n.setRequestHeader("If-Modified-Since", o.result.responseHeaders["Last-Modified"]), n.setRequestHeader("Cache-Control", "no-cache"))
                                      : o.result.responseHeaders.ETag && (n.setRequestHeader("If-None-Match", o.result.responseHeaders.ETag), n.setRequestHeader("Cache-Control", "no-cache")),
                                      n.send.apply(n, a);
                          },
                          function (e) {
                              n.send.apply(n, a);
                          }
                      )
                    : n.send.apply(n, a)
            );
        }),
            (a.prototype.open = function (e, r, n, a, i) {
                return (
                    (this.cache.result = o(t(r), this.cache.company, this.cache.product, Date.now())),
                    (this.cache.enabled =
                        ["must-revalidate", "immutable"].indexOf(this.cache.control) != -1 && "GET" == e && this.cache.result.url.match("^https?://") && ("undefined" == typeof n || n) && "undefined" == typeof a && "undefined" == typeof i),
                    (this.cache.revalidated = !1),
                    this.xhr.open.apply(this.xhr, arguments)
                );
            }),
            (a.prototype.setRequestHeader = function (e, t) {
                return (this.cache.enabled = !1), this.xhr.setRequestHeader.apply(this.xhr, arguments);
            });
        var u = new XMLHttpRequest();
        for (var f in u)
            a.prototype.hasOwnProperty(f) ||
                !(function (e) {
                    Object.defineProperty(
                        a.prototype,
                        e,
                        "function" == typeof u[e]
                            ? {
                                  value: function () {
                                      return this.xhr[e].apply(this.xhr, arguments);
                                  },
                              }
                            : {
                                  get: function () {
                                      return this.cache.revalidated && this.cache.result.xhr.hasOwnProperty(e) ? this.cache.result.xhr[e] : this.xhr[e];
                                  },
                                  set: function (t) {
                                      this.xhr[e] = t;
                                  },
                              }
                    );
                })(f);
        return a;
    })(),
    Utils: {
        assert: function (e, t) {
            e || abort("Assertion failed: " + t);
        },
        optimizeMathFround: function (e, t) {
            console.log("optimizing out Math.fround calls");
            for (
                var r = { LOOKING_FOR_MODULE: 0, SCANNING_MODULE_VARIABLES: 1, SCANNING_MODULE_FUNCTIONS: 2 },
                    n = ["EMSCRIPTEN_START_ASM", "EMSCRIPTEN_START_FUNCS", "EMSCRIPTEN_END_FUNCS"],
                    o = "var",
                    a = "global.Math.fround;",
                    i = 0,
                    s = t ? r.LOOKING_FOR_MODULE : r.SCANNING_MODULE_VARIABLES,
                    d = 0,
                    l = 0;
                s <= r.SCANNING_MODULE_FUNCTIONS && i < e.length;
                i++
            )
                if (47 == e[i] && 47 == e[i + 1] && 32 == e[i + 2] && String.fromCharCode.apply(null, e.subarray(i + 3, i + 3 + n[s].length)) === n[s]) s++;
                else if (s != r.SCANNING_MODULE_VARIABLES || l || 61 != e[i] || String.fromCharCode.apply(null, e.subarray(i + 1, i + 1 + a.length)) !== a) {
                    if (l && 40 == e[i]) {
                        for (var u = 0; u < l && e[i - 1 - u] == e[d - u]; ) u++;
                        if (u == l) {
                            var f = e[i - 1 - u];
                            if (f < 36 || (36 < f && f < 48) || (57 < f && f < 65) || (90 < f && f < 95) || (95 < f && f < 97) || 122 < f) for (; u; u--) e[i - u] = 32;
                        }
                    }
                } else {
                    for (d = i - 1; 32 != e[d - l]; ) l++;
                    (l && String.fromCharCode.apply(null, e.subarray(d - l - o.length, d - l)) === o) || (d = l = 0);
                }
            return e;
        },
    },
    Cryptography: {
        crc32: function (e) {
            var t = UnityLoader.Cryptography.crc32.module;
            if (!t) {
                var r = new ArrayBuffer(16777216),
                    n = (function (e, t, r) {
                        "use asm";
                        var n = new e.Uint8Array(r);
                        var o = new e.Uint32Array(r);
                        function a(e, t) {
                            e = e | 0;
                            t = t | 0;
                            var r = 0;
                            for (r = o[1024 >> 2] | 0; t; e = (e + 1) | 0, t = (t - 1) | 0) r = o[(((r & 255) ^ n[e]) << 2) >> 2] ^ (r >>> 8) ^ 4278190080;
                            o[1024 >> 2] = r;
                        }
                        return { process: a };
                    })({ Uint8Array: Uint8Array, Uint32Array: Uint32Array }, null, r);
                t = UnityLoader.Cryptography.crc32.module = { buffer: r, HEAPU8: new Uint8Array(r), HEAPU32: new Uint32Array(r), process: n.process, crc32: 1024, data: 1028 };
                for (var o = 0; o < 256; o++) {
                    for (var a = 255 ^ o, i = 0; i < 8; i++) a = (a >>> 1) ^ (1 & a ? 3988292384 : 0);
                    t.HEAPU32[o] = a;
                }
            }
            t.HEAPU32[t.crc32 >> 2] = 0;
            for (var s = 0; s < e.length; ) {
                var d = Math.min(t.HEAPU8.length - t.data, e.length - s);
                t.HEAPU8.set(e.subarray(s, s + d), t.data), (crc = t.process(t.data, d)), (s += d);
            }
            var l = t.HEAPU32[t.crc32 >> 2];
            return new Uint8Array([l >> 24, l >> 16, l >> 8, l]);
        },
        md5: function (e) {
            var t = UnityLoader.Cryptography.md5.module;
            if (!t) {
                var r = new ArrayBuffer(16777216),
                    n = (function (e, t, r) {
                        "use asm";
                        var n = new e.Uint32Array(r);
                        function o(e, t) {
                            e = e | 0;
                            t = t | 0;
                            var r = 0,
                                o = 0,
                                a = 0,
                                i = 0,
                                s = 0,
                                d = 0,
                                l = 0,
                                u = 0,
                                f = 0,
                                c = 0,
                                h = 0,
                                p = 0;
                            (r = n[128] | 0), (o = n[129] | 0), (a = n[130] | 0), (i = n[131] | 0);
                            for (; t; e = (e + 64) | 0, t = (t - 1) | 0) {
                                s = r;
                                d = o;
                                l = a;
                                u = i;
                                for (c = 0; (c | 0) < 512; c = (c + 8) | 0) {
                                    p = n[c >> 2] | 0;
                                    r = (r + (n[(c + 4) >> 2] | 0) + (n[(e + (p >>> 14)) >> 2] | 0) + ((c | 0) < 128 ? i ^ (o & (a ^ i)) : (c | 0) < 256 ? a ^ (i & (o ^ a)) : (c | 0) < 384 ? o ^ a ^ i : a ^ (o | ~i))) | 0;
                                    h = (((r << (p & 31)) | (r >>> (32 - (p & 31)))) + o) | 0;
                                    r = i;
                                    i = a;
                                    a = o;
                                    o = h;
                                }
                                r = (r + s) | 0;
                                o = (o + d) | 0;
                                a = (a + l) | 0;
                                i = (i + u) | 0;
                            }
                            n[128] = r;
                            n[129] = o;
                            n[130] = a;
                            n[131] = i;
                        }
                        return { process: o };
                    })({ Uint32Array: Uint32Array }, null, r);
                (t = UnityLoader.Cryptography.md5.module = { buffer: r, HEAPU8: new Uint8Array(r), HEAPU32: new Uint32Array(r), process: n.process, md5: 512, data: 576 }),
                    t.HEAPU32.set(
                        new Uint32Array([
                            7,
                            3614090360,
                            65548,
                            3905402710,
                            131089,
                            606105819,
                            196630,
                            3250441966,
                            262151,
                            4118548399,
                            327692,
                            1200080426,
                            393233,
                            2821735955,
                            458774,
                            4249261313,
                            524295,
                            1770035416,
                            589836,
                            2336552879,
                            655377,
                            4294925233,
                            720918,
                            2304563134,
                            786439,
                            1804603682,
                            851980,
                            4254626195,
                            917521,
                            2792965006,
                            983062,
                            1236535329,
                            65541,
                            4129170786,
                            393225,
                            3225465664,
                            720910,
                            643717713,
                            20,
                            3921069994,
                            327685,
                            3593408605,
                            655369,
                            38016083,
                            983054,
                            3634488961,
                            262164,
                            3889429448,
                            589829,
                            568446438,
                            917513,
                            3275163606,
                            196622,
                            4107603335,
                            524308,
                            1163531501,
                            851973,
                            2850285829,
                            131081,
                            4243563512,
                            458766,
                            1735328473,
                            786452,
                            2368359562,
                            327684,
                            4294588738,
                            524299,
                            2272392833,
                            720912,
                            1839030562,
                            917527,
                            4259657740,
                            65540,
                            2763975236,
                            262155,
                            1272893353,
                            458768,
                            4139469664,
                            655383,
                            3200236656,
                            851972,
                            681279174,
                            11,
                            3936430074,
                            196624,
                            3572445317,
                            393239,
                            76029189,
                            589828,
                            3654602809,
                            786443,
                            3873151461,
                            983056,
                            530742520,
                            131095,
                            3299628645,
                            6,
                            4096336452,
                            458762,
                            1126891415,
                            917519,
                            2878612391,
                            327701,
                            4237533241,
                            786438,
                            1700485571,
                            196618,
                            2399980690,
                            655375,
                            4293915773,
                            65557,
                            2240044497,
                            524294,
                            1873313359,
                            983050,
                            4264355552,
                            393231,
                            2734768916,
                            851989,
                            1309151649,
                            262150,
                            4149444226,
                            720906,
                            3174756917,
                            131087,
                            718787259,
                            589845,
                            3951481745,
                        ])
                    );
            }
            t.HEAPU32.set(new Uint32Array([1732584193, 4023233417, 2562383102, 271733878]), t.md5 >> 2);
            for (var o = 0; o < e.length; ) {
                var a = Math.min(t.HEAPU8.length - t.data, e.length - o) & -64;
                if ((t.HEAPU8.set(e.subarray(o, o + a), t.data), (o += a), t.process(t.data, a >> 6), e.length - o < 64)) {
                    if (((a = e.length - o), t.HEAPU8.set(e.subarray(e.length - a, e.length), t.data), (o += a), (t.HEAPU8[t.data + a++] = 128), a > 56)) {
                        for (var i = a; i < 64; i++) t.HEAPU8[t.data + i] = 0;
                        t.process(t.data, 1), (a = 0);
                    }
                    for (var i = a; i < 64; i++) t.HEAPU8[t.data + i] = 0;
                    for (var s = e.length, d = 0, i = 56; i < 64; i++, d = (224 & s) >> 5, s /= 256) t.HEAPU8[t.data + i] = ((31 & s) << 3) + d;
                    t.process(t.data, 1);
                }
            }
            return new Uint8Array(t.HEAPU8.subarray(t.md5, t.md5 + 16));
        },
        sha1: function (e) {
            var t = UnityLoader.Cryptography.sha1.module;
            if (!t) {
                var r = new ArrayBuffer(16777216),
                    n = (function (e, t, r) {
                        "use asm";
                        var n = new e.Uint32Array(r);
                        function o(e, t) {
                            e = e | 0;
                            t = t | 0;
                            var r = 0,
                                o = 0,
                                a = 0,
                                i = 0,
                                s = 0,
                                d = 0,
                                l = 0,
                                u = 0,
                                f = 0,
                                c = 0,
                                h = 0,
                                p = 0;
                            (r = n[80] | 0), (o = n[81] | 0), (a = n[82] | 0), (i = n[83] | 0), (s = n[84] | 0);
                            for (; t; e = (e + 64) | 0, t = (t - 1) | 0) {
                                d = r;
                                l = o;
                                u = a;
                                f = i;
                                c = s;
                                for (p = 0; (p | 0) < 320; p = (p + 4) | 0, s = i, i = a, a = (o << 30) | (o >>> 2), o = r, r = h) {
                                    if ((p | 0) < 64) {
                                        h = n[(e + p) >> 2] | 0;
                                        h = ((h << 24) & 4278190080) | ((h << 8) & 16711680) | ((h >>> 8) & 65280) | ((h >>> 24) & 255);
                                    } else {
                                        h = n[(p - 12) >> 2] ^ n[(p - 32) >> 2] ^ n[(p - 56) >> 2] ^ n[(p - 64) >> 2];
                                        h = (h << 1) | (h >>> 31);
                                    }
                                    n[p >> 2] = h;
                                    h =
                                        (h +
                                            (((r << 5) | (r >>> 27)) + s) +
                                            ((p | 0) < 80
                                                ? (((o & a) | (~o & i) | 0) + 1518500249) | 0
                                                : (p | 0) < 160
                                                ? ((o ^ a ^ i) + 1859775393) | 0
                                                : (p | 0) < 240
                                                ? (((o & a) | (o & i) | (a & i)) + 2400959708) | 0
                                                : ((o ^ a ^ i) + 3395469782) | 0)) |
                                        0;
                                }
                                r = (r + d) | 0;
                                o = (o + l) | 0;
                                a = (a + u) | 0;
                                i = (i + f) | 0;
                                s = (s + c) | 0;
                            }
                            n[80] = r;
                            n[81] = o;
                            n[82] = a;
                            n[83] = i;
                            n[84] = s;
                        }
                        return { process: o };
                    })({ Uint32Array: Uint32Array }, null, r);
                t = UnityLoader.Cryptography.sha1.module = { buffer: r, HEAPU8: new Uint8Array(r), HEAPU32: new Uint32Array(r), process: n.process, sha1: 320, data: 384 };
            }
            t.HEAPU32.set(new Uint32Array([1732584193, 4023233417, 2562383102, 271733878, 3285377520]), t.sha1 >> 2);
            for (var o = 0; o < e.length; ) {
                var a = Math.min(t.HEAPU8.length - t.data, e.length - o) & -64;
                if ((t.HEAPU8.set(e.subarray(o, o + a), t.data), (o += a), t.process(t.data, a >> 6), e.length - o < 64)) {
                    if (((a = e.length - o), t.HEAPU8.set(e.subarray(e.length - a, e.length), t.data), (o += a), (t.HEAPU8[t.data + a++] = 128), a > 56)) {
                        for (var i = a; i < 64; i++) t.HEAPU8[t.data + i] = 0;
                        t.process(t.data, 1), (a = 0);
                    }
                    for (var i = a; i < 64; i++) t.HEAPU8[t.data + i] = 0;
                    for (var s = e.length, d = 0, i = 63; i >= 56; i--, d = (224 & s) >> 5, s /= 256) t.HEAPU8[t.data + i] = ((31 & s) << 3) + d;
                    t.process(t.data, 1);
                }
            }
            for (var l = new Uint8Array(20), i = 0; i < l.length; i++) l[i] = t.HEAPU8[t.sha1 + (i & -4) + 3 - (3 & i)];
            return l;
        },
    },
    Progress: {
        Styles: {
            Dark: {
                progressLogoUrl:
                    "",
                progressEmptyUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI0AAAASCAYAAABmbl0zAAAACXBIWXMAAAsSAAALEgHS3X78AAAATUlEQVRo3u3aIQ4AIAwEQUr4/5cPiyMVBDOj0M2mCKgkGdAwjYCudZzLOLiITYPrCdEgGkSDaEA0iAbRIBpEA6JBNHx1vnL7V4NNwxsbCNMGI3YImu0AAAAASUVORK5CYII=",
                progressFullUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI0AAAASCAYAAABmbl0zAAAACXBIWXMAAAsSAAALEgHS3X78AAAAO0lEQVRo3u3SQREAAAjDMMC/56EB3omEXjtJCg5GAkyDaTANpsE0YBpMg2kwDaYB02AaTINpMA2Yhr8FO18EIBpZMeQAAAAASUVORK5CYII=",
            },
            Light: {
                progressLogoUrl:
                    "",
                progressEmptyUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI0AAAASCAYAAABmbl0zAAAACXBIWXMAAAsSAAALEgHS3X78AAAAUUlEQVRo3u3aMQ4AEAxAUcRJzGb3v1mt3cQglvcmc/NTA3XMFQUuNCPgVk/nahwchE2D6wnRIBpEg2hANIgG0SAaRAOiQTR8lV+5/avBpuGNDcz6A6oq1CgNAAAAAElFTkSuQmCC",
                progressFullUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAI0AAAASCAYAAABmbl0zAAAACXBIWXMAAAsSAAALEgHS3X78AAAAQElEQVRo3u3SMREAMAgAsVIpnTvj3xlogDmR8PfxftaBgSsBpsE0mAbTYBowDabBNJgG04BpMA2mwTSYBkzDXgP/hgGnr4PpeAAAAABJRU5ErkJggg==",
            },
        },
        handler: function (e, t) {
            if (e.Module) {
                var r = UnityLoader.Progress.Styles[e.Module.splashScreenStyle],
                    n = e.Module.progressLogoUrl ? e.Module.resolveBuildUrl(e.Module.progressLogoUrl) : r.progressLogoUrl,
                    o = e.Module.progressEmptyUrl ? e.Module.resolveBuildUrl(e.Module.progressEmptyUrl) : r.progressEmptyUrl,
                    a = e.Module.progressFullUrl ? e.Module.resolveBuildUrl(e.Module.progressFullUrl) : r.progressFullUrl,
                    i = "position: absolute; left: 50%; top: 50%; -webkit-transform: translate(-50%, -50%); transform: translate(-50%, -50%);";
                e.logo || ((e.logo = document.createElement("div")), (e.logo.style.cssText = i + "background: url('" + n + "') no-repeat center / contain; width: 154px; height: 130px;"), e.container.appendChild(e.logo)),
                    e.progress ||
                        ((e.progress = document.createElement("div")),
                        (e.progress.style.cssText = i + " height: 18px; width: 141px; margin-top: 90px;"),
                        (e.progress.empty = document.createElement("div")),
                        (e.progress.empty.style.cssText = "background: url('" + o + "') no-repeat right / cover; float: right; width: 100%; height: 100%; display: inline-block;"),
                        e.progress.appendChild(e.progress.empty),
                        (e.progress.full = document.createElement("div")),
                        (e.progress.full.style.cssText = "background: url('" + a + "') no-repeat left / cover; float: left; width: 0%; height: 100%; display: inline-block;"),
                        e.progress.appendChild(e.progress.full),
                        e.container.appendChild(e.progress)),
                    (e.progress.full.style.width = 100 * t + "%"),
                    (e.progress.empty.style.width = 100 * (1 - t) + "%"),
                    1 == t && (e.logo.style.display = e.progress.style.display = "none");
            }
        },
        update: function (e, t, r) {
            var n = e.buildDownloadProgress[t];
            n || (n = e.buildDownloadProgress[t] = { started: !1, finished: !1, lengthComputable: !1, total: 0, loaded: 0 }),
                "object" != typeof r ||
                    ("progress" != r.type && "load" != r.type) ||
                    (n.started || ((n.started = !0), (n.lengthComputable = r.lengthComputable), (n.total = r.total)), (n.loaded = r.loaded), "load" == r.type && (n.finished = !0));
            var o = 0,
                a = 0,
                i = 0,
                s = 0,
                d = 0;
            for (var t in e.buildDownloadProgress) {
                var n = e.buildDownloadProgress[t];
                if (!n.started) return 0;
                i++, n.lengthComputable ? ((o += n.loaded), (a += n.total), s++) : n.finished || d++;
            }
            var l = i ? (i - d - (a ? (s * (a - o)) / a : 0)) / i : 0;
            e.gameInstance.onProgress(e.gameInstance, 0.9 * l);
        },
    },
    Compression: {
        identity: {
            require: function () {
                return {};
            },
            decompress: function (e) {
                return e;
            },
        },
        gzip: {
            require: function (e) {
                var t = {
                    "inflate.js": function (e, t, r) {
                        "use strict";
                        function n(e) {
                            if (!(this instanceof n)) return new n(e);
                            this.options = s.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e || {});
                            var t = this.options;
                            t.raw && t.windowBits >= 0 && t.windowBits < 16 && ((t.windowBits = -t.windowBits), 0 === t.windowBits && (t.windowBits = -15)),
                                !(t.windowBits >= 0 && t.windowBits < 16) || (e && e.windowBits) || (t.windowBits += 32),
                                t.windowBits > 15 && t.windowBits < 48 && 0 === (15 & t.windowBits) && (t.windowBits |= 15),
                                (this.err = 0),
                                (this.msg = ""),
                                (this.ended = !1),
                                (this.chunks = []),
                                (this.strm = new f()),
                                (this.strm.avail_out = 0);
                            var r = i.inflateInit2(this.strm, t.windowBits);
                            if (r !== l.Z_OK) throw new Error(u[r]);
                            (this.header = new c()), i.inflateGetHeader(this.strm, this.header);
                        }
                        function o(e, t) {
                            var r = new n(t);
                            if ((r.push(e, !0), r.err)) throw r.msg || u[r.err];
                            return r.result;
                        }
                        function a(e, t) {
                            return (t = t || {}), (t.raw = !0), o(e, t);
                        }
                        var i = e("./zlib/inflate"),
                            s = e("./utils/common"),
                            d = e("./utils/strings"),
                            l = e("./zlib/constants"),
                            u = e("./zlib/messages"),
                            f = e("./zlib/zstream"),
                            c = e("./zlib/gzheader"),
                            h = Object.prototype.toString;
                        (n.prototype.push = function (e, t) {
                            var r,
                                n,
                                o,
                                a,
                                u,
                                f,
                                c = this.strm,
                                p = this.options.chunkSize,
                                w = this.options.dictionary,
                                m = !1;
                            if (this.ended) return !1;
                            (n = t === ~~t ? t : t === !0 ? l.Z_FINISH : l.Z_NO_FLUSH),
                                "string" == typeof e ? (c.input = d.binstring2buf(e)) : "[object ArrayBuffer]" === h.call(e) ? (c.input = new Uint8Array(e)) : (c.input = e),
                                (c.next_in = 0),
                                (c.avail_in = c.input.length);
                            do {
                                if (
                                    (0 === c.avail_out && ((c.output = new s.Buf8(p)), (c.next_out = 0), (c.avail_out = p)),
                                    (r = i.inflate(c, l.Z_NO_FLUSH)),
                                    r === l.Z_NEED_DICT && w && ((f = "string" == typeof w ? d.string2buf(w) : "[object ArrayBuffer]" === h.call(w) ? new Uint8Array(w) : w), (r = i.inflateSetDictionary(this.strm, f))),
                                    r === l.Z_BUF_ERROR && m === !0 && ((r = l.Z_OK), (m = !1)),
                                    r !== l.Z_STREAM_END && r !== l.Z_OK)
                                )
                                    return this.onEnd(r), (this.ended = !0), !1;
                                c.next_out &&
                                    ((0 !== c.avail_out && r !== l.Z_STREAM_END && (0 !== c.avail_in || (n !== l.Z_FINISH && n !== l.Z_SYNC_FLUSH))) ||
                                        ("string" === this.options.to
                                            ? ((o = d.utf8border(c.output, c.next_out)),
                                              (a = c.next_out - o),
                                              (u = d.buf2string(c.output, o)),
                                              (c.next_out = a),
                                              (c.avail_out = p - a),
                                              a && s.arraySet(c.output, c.output, o, a, 0),
                                              this.onData(u))
                                            : this.onData(s.shrinkBuf(c.output, c.next_out)))),
                                    0 === c.avail_in && 0 === c.avail_out && (m = !0);
                            } while ((c.avail_in > 0 || 0 === c.avail_out) && r !== l.Z_STREAM_END);
                            return (
                                r === l.Z_STREAM_END && (n = l.Z_FINISH),
                                n === l.Z_FINISH ? ((r = i.inflateEnd(this.strm)), this.onEnd(r), (this.ended = !0), r === l.Z_OK) : n !== l.Z_SYNC_FLUSH || (this.onEnd(l.Z_OK), (c.avail_out = 0), !0)
                            );
                        }),
                            (n.prototype.onData = function (e) {
                                this.chunks.push(e);
                            }),
                            (n.prototype.onEnd = function (e) {
                                e === l.Z_OK && ("string" === this.options.to ? (this.result = this.chunks.join("")) : (this.result = s.flattenChunks(this.chunks))), (this.chunks = []), (this.err = e), (this.msg = this.strm.msg);
                            }),
                            (r.Inflate = n),
                            (r.inflate = o),
                            (r.inflateRaw = a),
                            (r.ungzip = o);
                    },
                    "utils/common.js": function (e, t, r) {
                        "use strict";
                        var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
                        (r.assign = function (e) {
                            for (var t = Array.prototype.slice.call(arguments, 1); t.length; ) {
                                var r = t.shift();
                                if (r) {
                                    if ("object" != typeof r) throw new TypeError(r + "must be non-object");
                                    for (var n in r) r.hasOwnProperty(n) && (e[n] = r[n]);
                                }
                            }
                            return e;
                        }),
                            (r.shrinkBuf = function (e, t) {
                                return e.length === t ? e : e.subarray ? e.subarray(0, t) : ((e.length = t), e);
                            });
                        var o = {
                                arraySet: function (e, t, r, n, o) {
                                    if (t.subarray && e.subarray) return void e.set(t.subarray(r, r + n), o);
                                    for (var a = 0; a < n; a++) e[o + a] = t[r + a];
                                },
                                flattenChunks: function (e) {
                                    var t, r, n, o, a, i;
                                    for (n = 0, t = 0, r = e.length; t < r; t++) n += e[t].length;
                                    for (i = new Uint8Array(n), o = 0, t = 0, r = e.length; t < r; t++) (a = e[t]), i.set(a, o), (o += a.length);
                                    return i;
                                },
                            },
                            a = {
                                arraySet: function (e, t, r, n, o) {
                                    for (var a = 0; a < n; a++) e[o + a] = t[r + a];
                                },
                                flattenChunks: function (e) {
                                    return [].concat.apply([], e);
                                },
                            };
                        (r.setTyped = function (e) {
                            e ? ((r.Buf8 = Uint8Array), (r.Buf16 = Uint16Array), (r.Buf32 = Int32Array), r.assign(r, o)) : ((r.Buf8 = Array), (r.Buf16 = Array), (r.Buf32 = Array), r.assign(r, a));
                        }),
                            r.setTyped(n);
                    },
                    "utils/strings.js": function (e, t, r) {
                        "use strict";
                        function n(e, t) {
                            if (t < 65537 && ((e.subarray && i) || (!e.subarray && a))) return String.fromCharCode.apply(null, o.shrinkBuf(e, t));
                            for (var r = "", n = 0; n < t; n++) r += String.fromCharCode(e[n]);
                            return r;
                        }
                        var o = e("./common"),
                            a = !0,
                            i = !0;
                        try {
                            String.fromCharCode.apply(null, [0]);
                        } catch (e) {
                            a = !1;
                        }
                        try {
                            String.fromCharCode.apply(null, new Uint8Array(1));
                        } catch (e) {
                            i = !1;
                        }
                        for (var s = new o.Buf8(256), d = 0; d < 256; d++) s[d] = d >= 252 ? 6 : d >= 248 ? 5 : d >= 240 ? 4 : d >= 224 ? 3 : d >= 192 ? 2 : 1;
                        (s[254] = s[254] = 1),
                            (r.string2buf = function (e) {
                                var t,
                                    r,
                                    n,
                                    a,
                                    i,
                                    s = e.length,
                                    d = 0;
                                for (a = 0; a < s; a++)
                                    (r = e.charCodeAt(a)),
                                        55296 === (64512 & r) && a + 1 < s && ((n = e.charCodeAt(a + 1)), 56320 === (64512 & n) && ((r = 65536 + ((r - 55296) << 10) + (n - 56320)), a++)),
                                        (d += r < 128 ? 1 : r < 2048 ? 2 : r < 65536 ? 3 : 4);
                                for (t = new o.Buf8(d), i = 0, a = 0; i < d; a++)
                                    (r = e.charCodeAt(a)),
                                        55296 === (64512 & r) && a + 1 < s && ((n = e.charCodeAt(a + 1)), 56320 === (64512 & n) && ((r = 65536 + ((r - 55296) << 10) + (n - 56320)), a++)),
                                        r < 128
                                            ? (t[i++] = r)
                                            : r < 2048
                                            ? ((t[i++] = 192 | (r >>> 6)), (t[i++] = 128 | (63 & r)))
                                            : r < 65536
                                            ? ((t[i++] = 224 | (r >>> 12)), (t[i++] = 128 | ((r >>> 6) & 63)), (t[i++] = 128 | (63 & r)))
                                            : ((t[i++] = 240 | (r >>> 18)), (t[i++] = 128 | ((r >>> 12) & 63)), (t[i++] = 128 | ((r >>> 6) & 63)), (t[i++] = 128 | (63 & r)));
                                return t;
                            }),
                            (r.buf2binstring = function (e) {
                                return n(e, e.length);
                            }),
                            (r.binstring2buf = function (e) {
                                for (var t = new o.Buf8(e.length), r = 0, n = t.length; r < n; r++) t[r] = e.charCodeAt(r);
                                return t;
                            }),
                            (r.buf2string = function (e, t) {
                                var r,
                                    o,
                                    a,
                                    i,
                                    d = t || e.length,
                                    l = new Array(2 * d);
                                for (o = 0, r = 0; r < d; )
                                    if (((a = e[r++]), a < 128)) l[o++] = a;
                                    else if (((i = s[a]), i > 4)) (l[o++] = 65533), (r += i - 1);
                                    else {
                                        for (a &= 2 === i ? 31 : 3 === i ? 15 : 7; i > 1 && r < d; ) (a = (a << 6) | (63 & e[r++])), i--;
                                        i > 1 ? (l[o++] = 65533) : a < 65536 ? (l[o++] = a) : ((a -= 65536), (l[o++] = 55296 | ((a >> 10) & 1023)), (l[o++] = 56320 | (1023 & a)));
                                    }
                                return n(l, o);
                            }),
                            (r.utf8border = function (e, t) {
                                var r;
                                for (t = t || e.length, t > e.length && (t = e.length), r = t - 1; r >= 0 && 128 === (192 & e[r]); ) r--;
                                return r < 0 ? t : 0 === r ? t : r + s[e[r]] > t ? r : t;
                            });
                    },
                    "zlib/inflate.js": function (e, t, r) {
                        "use strict";
                        function n(e) {
                            return ((e >>> 24) & 255) + ((e >>> 8) & 65280) + ((65280 & e) << 8) + ((255 & e) << 24);
                        }
                        function o() {
                            (this.mode = 0),
                                (this.last = !1),
                                (this.wrap = 0),
                                (this.havedict = !1),
                                (this.flags = 0),
                                (this.dmax = 0),
                                (this.check = 0),
                                (this.total = 0),
                                (this.head = null),
                                (this.wbits = 0),
                                (this.wsize = 0),
                                (this.whave = 0),
                                (this.wnext = 0),
                                (this.window = null),
                                (this.hold = 0),
                                (this.bits = 0),
                                (this.length = 0),
                                (this.offset = 0),
                                (this.extra = 0),
                                (this.lencode = null),
                                (this.distcode = null),
                                (this.lenbits = 0),
                                (this.distbits = 0),
                                (this.ncode = 0),
                                (this.nlen = 0),
                                (this.ndist = 0),
                                (this.have = 0),
                                (this.next = null),
                                (this.lens = new y.Buf16(320)),
                                (this.work = new y.Buf16(288)),
                                (this.lendyn = null),
                                (this.distdyn = null),
                                (this.sane = 0),
                                (this.back = 0),
                                (this.was = 0);
                        }
                        function a(e) {
                            var t;
                            return e && e.state
                                ? ((t = e.state),
                                  (e.total_in = e.total_out = t.total = 0),
                                  (e.msg = ""),
                                  t.wrap && (e.adler = 1 & t.wrap),
                                  (t.mode = I),
                                  (t.last = 0),
                                  (t.havedict = 0),
                                  (t.dmax = 32768),
                                  (t.head = null),
                                  (t.hold = 0),
                                  (t.bits = 0),
                                  (t.lencode = t.lendyn = new y.Buf32(we)),
                                  (t.distcode = t.distdyn = new y.Buf32(me)),
                                  (t.sane = 1),
                                  (t.back = -1),
                                  O)
                                : R;
                        }
                        function i(e) {
                            var t;
                            return e && e.state ? ((t = e.state), (t.wsize = 0), (t.whave = 0), (t.wnext = 0), a(e)) : R;
                        }
                        function s(e, t) {
                            var r, n;
                            return e && e.state
                                ? ((n = e.state),
                                  t < 0 ? ((r = 0), (t = -t)) : ((r = (t >> 4) + 1), t < 48 && (t &= 15)),
                                  t && (t < 8 || t > 15) ? R : (null !== n.window && n.wbits !== t && (n.window = null), (n.wrap = r), (n.wbits = t), i(e)))
                                : R;
                        }
                        function d(e, t) {
                            var r, n;
                            return e ? ((n = new o()), (e.state = n), (n.window = null), (r = s(e, t)), r !== O && (e.state = null), r) : R;
                        }
                        function l(e) {
                            return d(e, ye);
                        }
                        function u(e) {
                            if (ge) {
                                var t;
                                for (m = new y.Buf32(512), b = new y.Buf32(32), t = 0; t < 144; ) e.lens[t++] = 8;
                                for (; t < 256; ) e.lens[t++] = 9;
                                for (; t < 280; ) e.lens[t++] = 7;
                                for (; t < 288; ) e.lens[t++] = 8;
                                for (U(E, e.lens, 0, 288, m, 0, e.work, { bits: 9 }), t = 0; t < 32; ) e.lens[t++] = 5;
                                U(k, e.lens, 0, 32, b, 0, e.work, { bits: 5 }), (ge = !1);
                            }
                            (e.lencode = m), (e.lenbits = 9), (e.distcode = b), (e.distbits = 5);
                        }
                        function f(e, t, r, n) {
                            var o,
                                a = e.state;
                            return (
                                null === a.window && ((a.wsize = 1 << a.wbits), (a.wnext = 0), (a.whave = 0), (a.window = new y.Buf8(a.wsize))),
                                n >= a.wsize
                                    ? (y.arraySet(a.window, t, r - a.wsize, a.wsize, 0), (a.wnext = 0), (a.whave = a.wsize))
                                    : ((o = a.wsize - a.wnext),
                                      o > n && (o = n),
                                      y.arraySet(a.window, t, r - n, o, a.wnext),
                                      (n -= o),
                                      n ? (y.arraySet(a.window, t, r - n, n, 0), (a.wnext = n), (a.whave = a.wsize)) : ((a.wnext += o), a.wnext === a.wsize && (a.wnext = 0), a.whave < a.wsize && (a.whave += o))),
                                0
                            );
                        }
                        function c(e, t) {
                            var r,
                                o,
                                a,
                                i,
                                s,
                                d,
                                l,
                                c,
                                h,
                                p,
                                w,
                                m,
                                b,
                                we,
                                me,
                                be,
                                ye,
                                ge,
                                ve,
                                Ae,
                                Ue,
                                xe,
                                Ee,
                                ke,
                                Be = 0,
                                Le = new y.Buf8(4),
                                We = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
                            if (!e || !e.state || !e.output || (!e.input && 0 !== e.avail_in)) return R;
                            (r = e.state), r.mode === j && (r.mode = X), (s = e.next_out), (a = e.output), (l = e.avail_out), (i = e.next_in), (o = e.input), (d = e.avail_in), (c = r.hold), (h = r.bits), (p = d), (w = l), (xe = O);
                            e: for (;;)
                                switch (r.mode) {
                                    case I:
                                        if (0 === r.wrap) {
                                            r.mode = X;
                                            break;
                                        }
                                        for (; h < 16; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        if (2 & r.wrap && 35615 === c) {
                                            (r.check = 0), (Le[0] = 255 & c), (Le[1] = (c >>> 8) & 255), (r.check = v(r.check, Le, 2, 0)), (c = 0), (h = 0), (r.mode = P);
                                            break;
                                        }
                                        if (((r.flags = 0), r.head && (r.head.done = !1), !(1 & r.wrap) || (((255 & c) << 8) + (c >> 8)) % 31)) {
                                            (e.msg = "incorrect header check"), (r.mode = ce);
                                            break;
                                        }
                                        if ((15 & c) !== T) {
                                            (e.msg = "unknown compression method"), (r.mode = ce);
                                            break;
                                        }
                                        if (((c >>>= 4), (h -= 4), (Ue = (15 & c) + 8), 0 === r.wbits)) r.wbits = Ue;
                                        else if (Ue > r.wbits) {
                                            (e.msg = "invalid window size"), (r.mode = ce);
                                            break;
                                        }
                                        (r.dmax = 1 << Ue), (e.adler = r.check = 1), (r.mode = 512 & c ? G : j), (c = 0), (h = 0);
                                        break;
                                    case P:
                                        for (; h < 16; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        if (((r.flags = c), (255 & r.flags) !== T)) {
                                            (e.msg = "unknown compression method"), (r.mode = ce);
                                            break;
                                        }
                                        if (57344 & r.flags) {
                                            (e.msg = "unknown header flags set"), (r.mode = ce);
                                            break;
                                        }
                                        r.head && (r.head.text = (c >> 8) & 1), 512 & r.flags && ((Le[0] = 255 & c), (Le[1] = (c >>> 8) & 255), (r.check = v(r.check, Le, 2, 0))), (c = 0), (h = 0), (r.mode = D);
                                    case D:
                                        for (; h < 32; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        r.head && (r.head.time = c),
                                            512 & r.flags && ((Le[0] = 255 & c), (Le[1] = (c >>> 8) & 255), (Le[2] = (c >>> 16) & 255), (Le[3] = (c >>> 24) & 255), (r.check = v(r.check, Le, 4, 0))),
                                            (c = 0),
                                            (h = 0),
                                            (r.mode = F);
                                    case F:
                                        for (; h < 16; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        r.head && ((r.head.xflags = 255 & c), (r.head.os = c >> 8)), 512 & r.flags && ((Le[0] = 255 & c), (Le[1] = (c >>> 8) & 255), (r.check = v(r.check, Le, 2, 0))), (c = 0), (h = 0), (r.mode = q);
                                    case q:
                                        if (1024 & r.flags) {
                                            for (; h < 16; ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            (r.length = c), r.head && (r.head.extra_len = c), 512 & r.flags && ((Le[0] = 255 & c), (Le[1] = (c >>> 8) & 255), (r.check = v(r.check, Le, 2, 0))), (c = 0), (h = 0);
                                        } else r.head && (r.head.extra = null);
                                        r.mode = V;
                                    case V:
                                        if (
                                            1024 & r.flags &&
                                            ((m = r.length),
                                            m > d && (m = d),
                                            m &&
                                                (r.head && ((Ue = r.head.extra_len - r.length), r.head.extra || (r.head.extra = new Array(r.head.extra_len)), y.arraySet(r.head.extra, o, i, m, Ue)),
                                                512 & r.flags && (r.check = v(r.check, o, m, i)),
                                                (d -= m),
                                                (i += m),
                                                (r.length -= m)),
                                            r.length)
                                        )
                                            break e;
                                        (r.length = 0), (r.mode = Z);
                                    case Z:
                                        if (2048 & r.flags) {
                                            if (0 === d) break e;
                                            m = 0;
                                            do (Ue = o[i + m++]), r.head && Ue && r.length < 65536 && (r.head.name += String.fromCharCode(Ue));
                                            while (Ue && m < d);
                                            if ((512 & r.flags && (r.check = v(r.check, o, m, i)), (d -= m), (i += m), Ue)) break e;
                                        } else r.head && (r.head.name = null);
                                        (r.length = 0), (r.mode = Y);
                                    case Y:
                                        if (4096 & r.flags) {
                                            if (0 === d) break e;
                                            m = 0;
                                            do (Ue = o[i + m++]), r.head && Ue && r.length < 65536 && (r.head.comment += String.fromCharCode(Ue));
                                            while (Ue && m < d);
                                            if ((512 & r.flags && (r.check = v(r.check, o, m, i)), (d -= m), (i += m), Ue)) break e;
                                        } else r.head && (r.head.comment = null);
                                        r.mode = z;
                                    case z:
                                        if (512 & r.flags) {
                                            for (; h < 16; ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            if (c !== (65535 & r.check)) {
                                                (e.msg = "header crc mismatch"), (r.mode = ce);
                                                break;
                                            }
                                            (c = 0), (h = 0);
                                        }
                                        r.head && ((r.head.hcrc = (r.flags >> 9) & 1), (r.head.done = !0)), (e.adler = r.check = 0), (r.mode = j);
                                        break;
                                    case G:
                                        for (; h < 32; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        (e.adler = r.check = n(c)), (c = 0), (h = 0), (r.mode = J);
                                    case J:
                                        if (0 === r.havedict) return (e.next_out = s), (e.avail_out = l), (e.next_in = i), (e.avail_in = d), (r.hold = c), (r.bits = h), N;
                                        (e.adler = r.check = 1), (r.mode = j);
                                    case j:
                                        if (t === L || t === W) break e;
                                    case X:
                                        if (r.last) {
                                            (c >>>= 7 & h), (h -= 7 & h), (r.mode = le);
                                            break;
                                        }
                                        for (; h < 3; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        switch (((r.last = 1 & c), (c >>>= 1), (h -= 1), 3 & c)) {
                                            case 0:
                                                r.mode = K;
                                                break;
                                            case 1:
                                                if ((u(r), (r.mode = re), t === W)) {
                                                    (c >>>= 2), (h -= 2);
                                                    break e;
                                                }
                                                break;
                                            case 2:
                                                r.mode = $;
                                                break;
                                            case 3:
                                                (e.msg = "invalid block type"), (r.mode = ce);
                                        }
                                        (c >>>= 2), (h -= 2);
                                        break;
                                    case K:
                                        for (c >>>= 7 & h, h -= 7 & h; h < 32; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        if ((65535 & c) !== ((c >>> 16) ^ 65535)) {
                                            (e.msg = "invalid stored block lengths"), (r.mode = ce);
                                            break;
                                        }
                                        if (((r.length = 65535 & c), (c = 0), (h = 0), (r.mode = Q), t === W)) break e;
                                    case Q:
                                        r.mode = _;
                                    case _:
                                        if ((m = r.length)) {
                                            if ((m > d && (m = d), m > l && (m = l), 0 === m)) break e;
                                            y.arraySet(a, o, i, m, s), (d -= m), (i += m), (l -= m), (s += m), (r.length -= m);
                                            break;
                                        }
                                        r.mode = j;
                                        break;
                                    case $:
                                        for (; h < 14; ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        if (((r.nlen = (31 & c) + 257), (c >>>= 5), (h -= 5), (r.ndist = (31 & c) + 1), (c >>>= 5), (h -= 5), (r.ncode = (15 & c) + 4), (c >>>= 4), (h -= 4), r.nlen > 286 || r.ndist > 30)) {
                                            (e.msg = "too many length or distance symbols"), (r.mode = ce);
                                            break;
                                        }
                                        (r.have = 0), (r.mode = ee);
                                    case ee:
                                        for (; r.have < r.ncode; ) {
                                            for (; h < 3; ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            (r.lens[We[r.have++]] = 7 & c), (c >>>= 3), (h -= 3);
                                        }
                                        for (; r.have < 19; ) r.lens[We[r.have++]] = 0;
                                        if (((r.lencode = r.lendyn), (r.lenbits = 7), (Ee = { bits: r.lenbits }), (xe = U(x, r.lens, 0, 19, r.lencode, 0, r.work, Ee)), (r.lenbits = Ee.bits), xe)) {
                                            (e.msg = "invalid code lengths set"), (r.mode = ce);
                                            break;
                                        }
                                        (r.have = 0), (r.mode = te);
                                    case te:
                                        for (; r.have < r.nlen + r.ndist; ) {
                                            for (; (Be = r.lencode[c & ((1 << r.lenbits) - 1)]), (me = Be >>> 24), (be = (Be >>> 16) & 255), (ye = 65535 & Be), !(me <= h); ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            if (ye < 16) (c >>>= me), (h -= me), (r.lens[r.have++] = ye);
                                            else {
                                                if (16 === ye) {
                                                    for (ke = me + 2; h < ke; ) {
                                                        if (0 === d) break e;
                                                        d--, (c += o[i++] << h), (h += 8);
                                                    }
                                                    if (((c >>>= me), (h -= me), 0 === r.have)) {
                                                        (e.msg = "invalid bit length repeat"), (r.mode = ce);
                                                        break;
                                                    }
                                                    (Ue = r.lens[r.have - 1]), (m = 3 + (3 & c)), (c >>>= 2), (h -= 2);
                                                } else if (17 === ye) {
                                                    for (ke = me + 3; h < ke; ) {
                                                        if (0 === d) break e;
                                                        d--, (c += o[i++] << h), (h += 8);
                                                    }
                                                    (c >>>= me), (h -= me), (Ue = 0), (m = 3 + (7 & c)), (c >>>= 3), (h -= 3);
                                                } else {
                                                    for (ke = me + 7; h < ke; ) {
                                                        if (0 === d) break e;
                                                        d--, (c += o[i++] << h), (h += 8);
                                                    }
                                                    (c >>>= me), (h -= me), (Ue = 0), (m = 11 + (127 & c)), (c >>>= 7), (h -= 7);
                                                }
                                                if (r.have + m > r.nlen + r.ndist) {
                                                    (e.msg = "invalid bit length repeat"), (r.mode = ce);
                                                    break;
                                                }
                                                for (; m--; ) r.lens[r.have++] = Ue;
                                            }
                                        }
                                        if (r.mode === ce) break;
                                        if (0 === r.lens[256]) {
                                            (e.msg = "invalid code -- missing end-of-block"), (r.mode = ce);
                                            break;
                                        }
                                        if (((r.lenbits = 9), (Ee = { bits: r.lenbits }), (xe = U(E, r.lens, 0, r.nlen, r.lencode, 0, r.work, Ee)), (r.lenbits = Ee.bits), xe)) {
                                            (e.msg = "invalid literal/lengths set"), (r.mode = ce);
                                            break;
                                        }
                                        if (((r.distbits = 6), (r.distcode = r.distdyn), (Ee = { bits: r.distbits }), (xe = U(k, r.lens, r.nlen, r.ndist, r.distcode, 0, r.work, Ee)), (r.distbits = Ee.bits), xe)) {
                                            (e.msg = "invalid distances set"), (r.mode = ce);
                                            break;
                                        }
                                        if (((r.mode = re), t === W)) break e;
                                    case re:
                                        r.mode = ne;
                                    case ne:
                                        if (d >= 6 && l >= 258) {
                                            (e.next_out = s),
                                                (e.avail_out = l),
                                                (e.next_in = i),
                                                (e.avail_in = d),
                                                (r.hold = c),
                                                (r.bits = h),
                                                A(e, w),
                                                (s = e.next_out),
                                                (a = e.output),
                                                (l = e.avail_out),
                                                (i = e.next_in),
                                                (o = e.input),
                                                (d = e.avail_in),
                                                (c = r.hold),
                                                (h = r.bits),
                                                r.mode === j && (r.back = -1);
                                            break;
                                        }
                                        for (r.back = 0; (Be = r.lencode[c & ((1 << r.lenbits) - 1)]), (me = Be >>> 24), (be = (Be >>> 16) & 255), (ye = 65535 & Be), !(me <= h); ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        if (be && 0 === (240 & be)) {
                                            for (ge = me, ve = be, Ae = ye; (Be = r.lencode[Ae + ((c & ((1 << (ge + ve)) - 1)) >> ge)]), (me = Be >>> 24), (be = (Be >>> 16) & 255), (ye = 65535 & Be), !(ge + me <= h); ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            (c >>>= ge), (h -= ge), (r.back += ge);
                                        }
                                        if (((c >>>= me), (h -= me), (r.back += me), (r.length = ye), 0 === be)) {
                                            r.mode = de;
                                            break;
                                        }
                                        if (32 & be) {
                                            (r.back = -1), (r.mode = j);
                                            break;
                                        }
                                        if (64 & be) {
                                            (e.msg = "invalid literal/length code"), (r.mode = ce);
                                            break;
                                        }
                                        (r.extra = 15 & be), (r.mode = oe);
                                    case oe:
                                        if (r.extra) {
                                            for (ke = r.extra; h < ke; ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            (r.length += c & ((1 << r.extra) - 1)), (c >>>= r.extra), (h -= r.extra), (r.back += r.extra);
                                        }
                                        (r.was = r.length), (r.mode = ae);
                                    case ae:
                                        for (; (Be = r.distcode[c & ((1 << r.distbits) - 1)]), (me = Be >>> 24), (be = (Be >>> 16) & 255), (ye = 65535 & Be), !(me <= h); ) {
                                            if (0 === d) break e;
                                            d--, (c += o[i++] << h), (h += 8);
                                        }
                                        if (0 === (240 & be)) {
                                            for (ge = me, ve = be, Ae = ye; (Be = r.distcode[Ae + ((c & ((1 << (ge + ve)) - 1)) >> ge)]), (me = Be >>> 24), (be = (Be >>> 16) & 255), (ye = 65535 & Be), !(ge + me <= h); ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            (c >>>= ge), (h -= ge), (r.back += ge);
                                        }
                                        if (((c >>>= me), (h -= me), (r.back += me), 64 & be)) {
                                            (e.msg = "invalid distance code"), (r.mode = ce);
                                            break;
                                        }
                                        (r.offset = ye), (r.extra = 15 & be), (r.mode = ie);
                                    case ie:
                                        if (r.extra) {
                                            for (ke = r.extra; h < ke; ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            (r.offset += c & ((1 << r.extra) - 1)), (c >>>= r.extra), (h -= r.extra), (r.back += r.extra);
                                        }
                                        if (r.offset > r.dmax) {
                                            (e.msg = "invalid distance too far back"), (r.mode = ce);
                                            break;
                                        }
                                        r.mode = se;
                                    case se:
                                        if (0 === l) break e;
                                        if (((m = w - l), r.offset > m)) {
                                            if (((m = r.offset - m), m > r.whave && r.sane)) {
                                                (e.msg = "invalid distance too far back"), (r.mode = ce);
                                                break;
                                            }
                                            m > r.wnext ? ((m -= r.wnext), (b = r.wsize - m)) : (b = r.wnext - m), m > r.length && (m = r.length), (we = r.window);
                                        } else (we = a), (b = s - r.offset), (m = r.length);
                                        m > l && (m = l), (l -= m), (r.length -= m);
                                        do a[s++] = we[b++];
                                        while (--m);
                                        0 === r.length && (r.mode = ne);
                                        break;
                                    case de:
                                        if (0 === l) break e;
                                        (a[s++] = r.length), l--, (r.mode = ne);
                                        break;
                                    case le:
                                        if (r.wrap) {
                                            for (; h < 32; ) {
                                                if (0 === d) break e;
                                                d--, (c |= o[i++] << h), (h += 8);
                                            }
                                            if (((w -= l), (e.total_out += w), (r.total += w), w && (e.adler = r.check = r.flags ? v(r.check, a, w, s - w) : g(r.check, a, w, s - w)), (w = l), (r.flags ? c : n(c)) !== r.check)) {
                                                (e.msg = "incorrect data check"), (r.mode = ce);
                                                break;
                                            }
                                            (c = 0), (h = 0);
                                        }
                                        r.mode = ue;
                                    case ue:
                                        if (r.wrap && r.flags) {
                                            for (; h < 32; ) {
                                                if (0 === d) break e;
                                                d--, (c += o[i++] << h), (h += 8);
                                            }
                                            if (c !== (4294967295 & r.total)) {
                                                (e.msg = "incorrect length check"), (r.mode = ce);
                                                break;
                                            }
                                            (c = 0), (h = 0);
                                        }
                                        r.mode = fe;
                                    case fe:
                                        xe = M;
                                        break e;
                                    case ce:
                                        xe = C;
                                        break e;
                                    case he:
                                        return H;
                                    case pe:
                                    default:
                                        return R;
                                }
                            return (
                                (e.next_out = s),
                                (e.avail_out = l),
                                (e.next_in = i),
                                (e.avail_in = d),
                                (r.hold = c),
                                (r.bits = h),
                                (r.wsize || (w !== e.avail_out && r.mode < ce && (r.mode < le || t !== B))) && f(e, e.output, e.next_out, w - e.avail_out)
                                    ? ((r.mode = he), H)
                                    : ((p -= e.avail_in),
                                      (w -= e.avail_out),
                                      (e.total_in += p),
                                      (e.total_out += w),
                                      (r.total += w),
                                      r.wrap && w && (e.adler = r.check = r.flags ? v(r.check, a, w, e.next_out - w) : g(r.check, a, w, e.next_out - w)),
                                      (e.data_type = r.bits + (r.last ? 64 : 0) + (r.mode === j ? 128 : 0) + (r.mode === re || r.mode === Q ? 256 : 0)),
                                      ((0 === p && 0 === w) || t === B) && xe === O && (xe = S),
                                      xe)
                            );
                        }
                        function h(e) {
                            if (!e || !e.state) return R;
                            var t = e.state;
                            return t.window && (t.window = null), (e.state = null), O;
                        }
                        function p(e, t) {
                            var r;
                            return e && e.state ? ((r = e.state), 0 === (2 & r.wrap) ? R : ((r.head = t), (t.done = !1), O)) : R;
                        }
                        function w(e, t) {
                            var r,
                                n,
                                o,
                                a = t.length;
                            return e && e.state ? ((r = e.state), 0 !== r.wrap && r.mode !== J ? R : r.mode === J && ((n = 1), (n = g(n, t, a, 0)), n !== r.check) ? C : (o = f(e, t, a, a)) ? ((r.mode = he), H) : ((r.havedict = 1), O)) : R;
                        }
                        var m,
                            b,
                            y = e("../utils/common"),
                            g = e("./adler32"),
                            v = e("./crc32"),
                            A = e("./inffast"),
                            U = e("./inftrees"),
                            x = 0,
                            E = 1,
                            k = 2,
                            B = 4,
                            L = 5,
                            W = 6,
                            O = 0,
                            M = 1,
                            N = 2,
                            R = -2,
                            C = -3,
                            H = -4,
                            S = -5,
                            T = 8,
                            I = 1,
                            P = 2,
                            D = 3,
                            F = 4,
                            q = 5,
                            V = 6,
                            Z = 7,
                            Y = 8,
                            z = 9,
                            G = 10,
                            J = 11,
                            j = 12,
                            X = 13,
                            K = 14,
                            Q = 15,
                            _ = 16,
                            $ = 17,
                            ee = 18,
                            te = 19,
                            re = 20,
                            ne = 21,
                            oe = 22,
                            ae = 23,
                            ie = 24,
                            se = 25,
                            de = 26,
                            le = 27,
                            ue = 28,
                            fe = 29,
                            ce = 30,
                            he = 31,
                            pe = 32,
                            we = 852,
                            me = 592,
                            be = 15,
                            ye = be,
                            ge = !0;
                        (r.inflateReset = i),
                            (r.inflateReset2 = s),
                            (r.inflateResetKeep = a),
                            (r.inflateInit = l),
                            (r.inflateInit2 = d),
                            (r.inflate = c),
                            (r.inflateEnd = h),
                            (r.inflateGetHeader = p),
                            (r.inflateSetDictionary = w),
                            (r.inflateInfo = "pako inflate (from Nodeca project)");
                    },
                    "zlib/constants.js": function (e, t, r) {
                        "use strict";
                        t.exports = {
                            Z_NO_FLUSH: 0,
                            Z_PARTIAL_FLUSH: 1,
                            Z_SYNC_FLUSH: 2,
                            Z_FULL_FLUSH: 3,
                            Z_FINISH: 4,
                            Z_BLOCK: 5,
                            Z_TREES: 6,
                            Z_OK: 0,
                            Z_STREAM_END: 1,
                            Z_NEED_DICT: 2,
                            Z_ERRNO: -1,
                            Z_STREAM_ERROR: -2,
                            Z_DATA_ERROR: -3,
                            Z_BUF_ERROR: -5,
                            Z_NO_COMPRESSION: 0,
                            Z_BEST_SPEED: 1,
                            Z_BEST_COMPRESSION: 9,
                            Z_DEFAULT_COMPRESSION: -1,
                            Z_FILTERED: 1,
                            Z_HUFFMAN_ONLY: 2,
                            Z_RLE: 3,
                            Z_FIXED: 4,
                            Z_DEFAULT_STRATEGY: 0,
                            Z_BINARY: 0,
                            Z_TEXT: 1,
                            Z_UNKNOWN: 2,
                            Z_DEFLATED: 8,
                        };
                    },
                    "zlib/messages.js": function (e, t, r) {
                        "use strict";
                        t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
                    },
                    "zlib/zstream.js": function (e, t, r) {
                        "use strict";
                        function n() {
                            (this.input = null),
                                (this.next_in = 0),
                                (this.avail_in = 0),
                                (this.total_in = 0),
                                (this.output = null),
                                (this.next_out = 0),
                                (this.avail_out = 0),
                                (this.total_out = 0),
                                (this.msg = ""),
                                (this.state = null),
                                (this.data_type = 2),
                                (this.adler = 0);
                        }
                        t.exports = n;
                    },
                    "zlib/gzheader.js": function (e, t, r) {
                        "use strict";
                        function n() {
                            (this.text = 0), (this.time = 0), (this.xflags = 0), (this.os = 0), (this.extra = null), (this.extra_len = 0), (this.name = ""), (this.comment = ""), (this.hcrc = 0), (this.done = !1);
                        }
                        t.exports = n;
                    },
                    "zlib/adler32.js": function (e, t, r) {
                        "use strict";
                        function n(e, t, r, n) {
                            for (var o = (65535 & e) | 0, a = ((e >>> 16) & 65535) | 0, i = 0; 0 !== r; ) {
                                (i = r > 2e3 ? 2e3 : r), (r -= i);
                                do (o = (o + t[n++]) | 0), (a = (a + o) | 0);
                                while (--i);
                                (o %= 65521), (a %= 65521);
                            }
                            return o | (a << 16) | 0;
                        }
                        t.exports = n;
                    },
                    "zlib/crc32.js": function (e, t, r) {
                        "use strict";
                        function n() {
                            for (var e, t = [], r = 0; r < 256; r++) {
                                e = r;
                                for (var n = 0; n < 8; n++) e = 1 & e ? 3988292384 ^ (e >>> 1) : e >>> 1;
                                t[r] = e;
                            }
                            return t;
                        }
                        function o(e, t, r, n) {
                            var o = a,
                                i = n + r;
                            e ^= -1;
                            for (var s = n; s < i; s++) e = (e >>> 8) ^ o[255 & (e ^ t[s])];
                            return e ^ -1;
                        }
                        var a = n();
                        t.exports = o;
                    },
                    "zlib/inffast.js": function (e, t, r) {
                        "use strict";
                        var n = 30,
                            o = 12;
                        t.exports = function (e, t) {
                            var r, a, i, s, d, l, u, f, c, h, p, w, m, b, y, g, v, A, U, x, E, k, B, L, W;
                            (r = e.state),
                                (a = e.next_in),
                                (L = e.input),
                                (i = a + (e.avail_in - 5)),
                                (s = e.next_out),
                                (W = e.output),
                                (d = s - (t - e.avail_out)),
                                (l = s + (e.avail_out - 257)),
                                (u = r.dmax),
                                (f = r.wsize),
                                (c = r.whave),
                                (h = r.wnext),
                                (p = r.window),
                                (w = r.hold),
                                (m = r.bits),
                                (b = r.lencode),
                                (y = r.distcode),
                                (g = (1 << r.lenbits) - 1),
                                (v = (1 << r.distbits) - 1);
                            e: do {
                                m < 15 && ((w += L[a++] << m), (m += 8), (w += L[a++] << m), (m += 8)), (A = b[w & g]);
                                t: for (;;) {
                                    if (((U = A >>> 24), (w >>>= U), (m -= U), (U = (A >>> 16) & 255), 0 === U)) W[s++] = 65535 & A;
                                    else {
                                        if (!(16 & U)) {
                                            if (0 === (64 & U)) {
                                                A = b[(65535 & A) + (w & ((1 << U) - 1))];
                                                continue t;
                                            }
                                            if (32 & U) {
                                                r.mode = o;
                                                break e;
                                            }
                                            (e.msg = "invalid literal/length code"), (r.mode = n);
                                            break e;
                                        }
                                        (x = 65535 & A),
                                            (U &= 15),
                                            U && (m < U && ((w += L[a++] << m), (m += 8)), (x += w & ((1 << U) - 1)), (w >>>= U), (m -= U)),
                                            m < 15 && ((w += L[a++] << m), (m += 8), (w += L[a++] << m), (m += 8)),
                                            (A = y[w & v]);
                                        r: for (;;) {
                                            if (((U = A >>> 24), (w >>>= U), (m -= U), (U = (A >>> 16) & 255), !(16 & U))) {
                                                if (0 === (64 & U)) {
                                                    A = y[(65535 & A) + (w & ((1 << U) - 1))];
                                                    continue r;
                                                }
                                                (e.msg = "invalid distance code"), (r.mode = n);
                                                break e;
                                            }
                                            if (((E = 65535 & A), (U &= 15), m < U && ((w += L[a++] << m), (m += 8), m < U && ((w += L[a++] << m), (m += 8))), (E += w & ((1 << U) - 1)), E > u)) {
                                                (e.msg = "invalid distance too far back"), (r.mode = n);
                                                break e;
                                            }
                                            if (((w >>>= U), (m -= U), (U = s - d), E > U)) {
                                                if (((U = E - U), U > c && r.sane)) {
                                                    (e.msg = "invalid distance too far back"), (r.mode = n);
                                                    break e;
                                                }
                                                if (((k = 0), (B = p), 0 === h)) {
                                                    if (((k += f - U), U < x)) {
                                                        x -= U;
                                                        do W[s++] = p[k++];
                                                        while (--U);
                                                        (k = s - E), (B = W);
                                                    }
                                                } else if (h < U) {
                                                    if (((k += f + h - U), (U -= h), U < x)) {
                                                        x -= U;
                                                        do W[s++] = p[k++];
                                                        while (--U);
                                                        if (((k = 0), h < x)) {
                                                            (U = h), (x -= U);
                                                            do W[s++] = p[k++];
                                                            while (--U);
                                                            (k = s - E), (B = W);
                                                        }
                                                    }
                                                } else if (((k += h - U), U < x)) {
                                                    x -= U;
                                                    do W[s++] = p[k++];
                                                    while (--U);
                                                    (k = s - E), (B = W);
                                                }
                                                for (; x > 2; ) (W[s++] = B[k++]), (W[s++] = B[k++]), (W[s++] = B[k++]), (x -= 3);
                                                x && ((W[s++] = B[k++]), x > 1 && (W[s++] = B[k++]));
                                            } else {
                                                k = s - E;
                                                do (W[s++] = W[k++]), (W[s++] = W[k++]), (W[s++] = W[k++]), (x -= 3);
                                                while (x > 2);
                                                x && ((W[s++] = W[k++]), x > 1 && (W[s++] = W[k++]));
                                            }
                                            break;
                                        }
                                    }
                                    break;
                                }
                            } while (a < i && s < l);
                            (x = m >> 3),
                                (a -= x),
                                (m -= x << 3),
                                (w &= (1 << m) - 1),
                                (e.next_in = a),
                                (e.next_out = s),
                                (e.avail_in = a < i ? 5 + (i - a) : 5 - (a - i)),
                                (e.avail_out = s < l ? 257 + (l - s) : 257 - (s - l)),
                                (r.hold = w),
                                (r.bits = m);
                        };
                    },
                    "zlib/inftrees.js": function (e, t, r) {
                        "use strict";
                        var n = e("../utils/common"),
                            o = 15,
                            a = 852,
                            i = 592,
                            s = 0,
                            d = 1,
                            l = 2,
                            u = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0],
                            f = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78],
                            c = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0],
                            h = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
                        t.exports = function (e, t, r, p, w, m, b, y) {
                            var g,
                                v,
                                A,
                                U,
                                x,
                                E,
                                k,
                                B,
                                L,
                                W = y.bits,
                                O = 0,
                                M = 0,
                                N = 0,
                                R = 0,
                                C = 0,
                                H = 0,
                                S = 0,
                                T = 0,
                                I = 0,
                                P = 0,
                                D = null,
                                F = 0,
                                q = new n.Buf16(o + 1),
                                V = new n.Buf16(o + 1),
                                Z = null,
                                Y = 0;
                            for (O = 0; O <= o; O++) q[O] = 0;
                            for (M = 0; M < p; M++) q[t[r + M]]++;
                            for (C = W, R = o; R >= 1 && 0 === q[R]; R--);
                            if ((C > R && (C = R), 0 === R)) return (w[m++] = 20971520), (w[m++] = 20971520), (y.bits = 1), 0;
                            for (N = 1; N < R && 0 === q[N]; N++);
                            for (C < N && (C = N), T = 1, O = 1; O <= o; O++) if (((T <<= 1), (T -= q[O]), T < 0)) return -1;
                            if (T > 0 && (e === s || 1 !== R)) return -1;
                            for (V[1] = 0, O = 1; O < o; O++) V[O + 1] = V[O] + q[O];
                            for (M = 0; M < p; M++) 0 !== t[r + M] && (b[V[t[r + M]]++] = M);
                            if (
                                (e === s ? ((D = Z = b), (E = 19)) : e === d ? ((D = u), (F -= 257), (Z = f), (Y -= 257), (E = 256)) : ((D = c), (Z = h), (E = -1)),
                                (P = 0),
                                (M = 0),
                                (O = N),
                                (x = m),
                                (H = C),
                                (S = 0),
                                (A = -1),
                                (I = 1 << C),
                                (U = I - 1),
                                (e === d && I > a) || (e === l && I > i))
                            )
                                return 1;
                            for (;;) {
                                (k = O - S), b[M] < E ? ((B = 0), (L = b[M])) : b[M] > E ? ((B = Z[Y + b[M]]), (L = D[F + b[M]])) : ((B = 96), (L = 0)), (g = 1 << (O - S)), (v = 1 << H), (N = v);
                                do (v -= g), (w[x + (P >> S) + v] = (k << 24) | (B << 16) | L | 0);
                                while (0 !== v);
                                for (g = 1 << (O - 1); P & g; ) g >>= 1;
                                if ((0 !== g ? ((P &= g - 1), (P += g)) : (P = 0), M++, 0 === --q[O])) {
                                    if (O === R) break;
                                    O = t[r + b[M]];
                                }
                                if (O > C && (P & U) !== A) {
                                    for (0 === S && (S = C), x += N, H = O - S, T = 1 << H; H + S < R && ((T -= q[H + S]), !(T <= 0)); ) H++, (T <<= 1);
                                    if (((I += 1 << H), (e === d && I > a) || (e === l && I > i))) return 1;
                                    (A = P & U), (w[A] = (C << 24) | (H << 16) | (x - m) | 0);
                                }
                            }
                            return 0 !== P && (w[x + P] = ((O - S) << 24) | (64 << 16) | 0), (y.bits = C), 0;
                        };
                    },
                };
                for (var r in t) t[r].folder = r.substring(0, r.lastIndexOf("/") + 1);
                var n = function (e) {
                        var r = [];
                        return (
                            (e = e.split("/").every(function (e) {
                                return ".." == e ? r.pop() : "." == e || "" == e || r.push(e);
                            })
                                ? r.join("/")
                                : null),
                            e ? t[e] || t[e + ".js"] || t[e + "/index.js"] : null
                        );
                    },
                    o = function (e, t) {
                        return e ? n(e.folder + "node_modules/" + t) || o(e.parent, t) : null;
                    },
                    a = function (e, t) {
                        var r = t.match(/^\//) ? null : e ? (t.match(/^\.\.?\//) ? n(e.folder + t) : o(e, t)) : n(t);
                        if (!r) throw "module not found: " + t;
                        return r.exports || ((r.parent = e), r(a.bind(null, r), r, (r.exports = {}))), r.exports;
                    };
                return a(null, e);
            },
            decompress: function (e) {
                this.exports || (this.exports = this.require("inflate.js"));
                try {
                    return this.exports.inflate(e);
                } catch (e) {}
            },
            hasUnityMarker: function (e) {
                var t = 10,
                    r = "UnityWeb Compressed Content (gzip)";
                if (t > e.length || 31 != e[0] || 139 != e[1]) return !1;
                var n = e[3];
                if (4 & n) {
                    if (t + 2 > e.length) return !1;
                    if (((t += 2 + e[t] + (e[t + 1] << 8)), t > e.length)) return !1;
                }
                if (8 & n) {
                    for (; t < e.length && e[t]; ) t++;
                    if (t + 1 > e.length) return !1;
                    t++;
                }
                return 16 & n && String.fromCharCode.apply(null, e.subarray(t, t + r.length + 1)) == r + "\0";
            },
        },
        brotli: {
            require: function (e) {
                var t = {
                    "decompress.js": function (e, t, r) {
                        t.exports = e("./dec/decode").BrotliDecompressBuffer;
                    },
                    "dec/bit_reader.js": function (e, t, r) {
                        function n(e) {
                            (this.buf_ = new Uint8Array(a)), (this.input_ = e), this.reset();
                        }
                        const o = 4096,
                            a = 8224,
                            i = 8191,
                            s = new Uint32Array([0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535, 131071, 262143, 524287, 1048575, 2097151, 4194303, 8388607, 16777215]);
                        (n.READ_SIZE = o),
                            (n.IBUF_MASK = i),
                            (n.prototype.reset = function () {
                                (this.buf_ptr_ = 0), (this.val_ = 0), (this.pos_ = 0), (this.bit_pos_ = 0), (this.bit_end_pos_ = 0), (this.eos_ = 0), this.readMoreInput();
                                for (var e = 0; e < 4; e++) (this.val_ |= this.buf_[this.pos_] << (8 * e)), ++this.pos_;
                                return this.bit_end_pos_ > 0;
                            }),
                            (n.prototype.readMoreInput = function () {
                                if (!(this.bit_end_pos_ > 256))
                                    if (this.eos_) {
                                        if (this.bit_pos_ > this.bit_end_pos_) throw new Error("Unexpected end of input " + this.bit_pos_ + " " + this.bit_end_pos_);
                                    } else {
                                        var e = this.buf_ptr_,
                                            t = this.input_.read(this.buf_, e, o);
                                        if (t < 0) throw new Error("Unexpected end of input");
                                        if (t < o) {
                                            this.eos_ = 1;
                                            for (var r = 0; r < 32; r++) this.buf_[e + t + r] = 0;
                                        }
                                        if (0 === e) {
                                            for (var r = 0; r < 32; r++) this.buf_[8192 + r] = this.buf_[r];
                                            this.buf_ptr_ = o;
                                        } else this.buf_ptr_ = 0;
                                        this.bit_end_pos_ += t << 3;
                                    }
                            }),
                            (n.prototype.fillBitWindow = function () {
                                for (; this.bit_pos_ >= 8; ) (this.val_ >>>= 8), (this.val_ |= this.buf_[this.pos_ & i] << 24), ++this.pos_, (this.bit_pos_ = (this.bit_pos_ - 8) >>> 0), (this.bit_end_pos_ = (this.bit_end_pos_ - 8) >>> 0);
                            }),
                            (n.prototype.readBits = function (e) {
                                32 - this.bit_pos_ < e && this.fillBitWindow();
                                var t = (this.val_ >>> this.bit_pos_) & s[e];
                                return (this.bit_pos_ += e), t;
                            }),
                            (t.exports = n);
                    },
                    "dec/context.js": function (e, t, r) {
                        (r.lookup = new Uint8Array([
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            4,
                            4,
                            0,
                            0,
                            4,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            8,
                            12,
                            16,
                            12,
                            12,
                            20,
                            12,
                            16,
                            24,
                            28,
                            12,
                            12,
                            32,
                            12,
                            36,
                            12,
                            44,
                            44,
                            44,
                            44,
                            44,
                            44,
                            44,
                            44,
                            44,
                            44,
                            32,
                            32,
                            24,
                            40,
                            28,
                            12,
                            12,
                            48,
                            52,
                            52,
                            52,
                            48,
                            52,
                            52,
                            52,
                            48,
                            52,
                            52,
                            52,
                            52,
                            52,
                            48,
                            52,
                            52,
                            52,
                            52,
                            52,
                            48,
                            52,
                            52,
                            52,
                            52,
                            52,
                            24,
                            12,
                            28,
                            12,
                            12,
                            12,
                            56,
                            60,
                            60,
                            60,
                            56,
                            60,
                            60,
                            60,
                            56,
                            60,
                            60,
                            60,
                            60,
                            60,
                            56,
                            60,
                            60,
                            60,
                            60,
                            60,
                            56,
                            60,
                            60,
                            60,
                            60,
                            60,
                            24,
                            12,
                            28,
                            12,
                            0,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            0,
                            1,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            2,
                            3,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            1,
                            1,
                            1,
                            1,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            0,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            1,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            2,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            3,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            4,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            5,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            6,
                            7,
                            0,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            8,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            16,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            24,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            32,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            40,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            48,
                            56,
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8,
                            9,
                            10,
                            11,
                            12,
                            13,
                            14,
                            15,
                            16,
                            17,
                            18,
                            19,
                            20,
                            21,
                            22,
                            23,
                            24,
                            25,
                            26,
                            27,
                            28,
                            29,
                            30,
                            31,
                            32,
                            33,
                            34,
                            35,
                            36,
                            37,
                            38,
                            39,
                            40,
                            41,
                            42,
                            43,
                            44,
                            45,
                            46,
                            47,
                            48,
                            49,
                            50,
                            51,
                            52,
                            53,
                            54,
                            55,
                            56,
                            57,
                            58,
                            59,
                            60,
                            61,
                            62,
                            63,
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8,
                            9,
                            10,
                            11,
                            12,
                            13,
                            14,
                            15,
                            16,
                            17,
                            18,
                            19,
                            20,
                            21,
                            22,
                            23,
                            24,
                            25,
                            26,
                            27,
                            28,
                            29,
                            30,
                            31,
                            32,
                            33,
                            34,
                            35,
                            36,
                            37,
                            38,
                            39,
                            40,
                            41,
                            42,
                            43,
                            44,
                            45,
                            46,
                            47,
                            48,
                            49,
                            50,
                            51,
                            52,
                            53,
                            54,
                            55,
                            56,
                            57,
                            58,
                            59,
                            60,
                            61,
                            62,
                            63,
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8,
                            9,
                            10,
                            11,
                            12,
                            13,
                            14,
                            15,
                            16,
                            17,
                            18,
                            19,
                            20,
                            21,
                            22,
                            23,
                            24,
                            25,
                            26,
                            27,
                            28,
                            29,
                            30,
                            31,
                            32,
                            33,
                            34,
                            35,
                            36,
                            37,
                            38,
                            39,
                            40,
                            41,
                            42,
                            43,
                            44,
                            45,
                            46,
                            47,
                            48,
                            49,
                            50,
                            51,
                            52,
                            53,
                            54,
                            55,
                            56,
                            57,
                            58,
                            59,
                            60,
                            61,
                            62,
                            63,
                            0,
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8,
                            9,
                            10,
                            11,
                            12,
                            13,
                            14,
                            15,
                            16,
                            17,
                            18,
                            19,
                            20,
                            21,
                            22,
                            23,
                            24,
                            25,
                            26,
                            27,
                            28,
                            29,
                            30,
                            31,
                            32,
                            33,
                            34,
                            35,
                            36,
                            37,
                            38,
                            39,
                            40,
                            41,
                            42,
                            43,
                            44,
                            45,
                            46,
                            47,
                            48,
                            49,
                            50,
                            51,
                            52,
                            53,
                            54,
                            55,
                            56,
                            57,
                            58,
                            59,
                            60,
                            61,
                            62,
                            63,
                            0,
                            0,
                            0,
                            0,
                            1,
                            1,
                            1,
                            1,
                            2,
                            2,
                            2,
                            2,
                            3,
                            3,
                            3,
                            3,
                            4,
                            4,
                            4,
                            4,
                            5,
                            5,
                            5,
                            5,
                            6,
                            6,
                            6,
                            6,
                            7,
                            7,
                            7,
                            7,
                            8,
                            8,
                            8,
                            8,
                            9,
                            9,
                            9,
                            9,
                            10,
                            10,
                            10,
                            10,
                            11,
                            11,
                            11,
                            11,
                            12,
                            12,
                            12,
                            12,
                            13,
                            13,
                            13,
                            13,
                            14,
                            14,
                            14,
                            14,
                            15,
                            15,
                            15,
                            15,
                            16,
                            16,
                            16,
                            16,
                            17,
                            17,
                            17,
                            17,
                            18,
                            18,
                            18,
                            18,
                            19,
                            19,
                            19,
                            19,
                            20,
                            20,
                            20,
                            20,
                            21,
                            21,
                            21,
                            21,
                            22,
                            22,
                            22,
                            22,
                            23,
                            23,
                            23,
                            23,
                            24,
                            24,
                            24,
                            24,
                            25,
                            25,
                            25,
                            25,
                            26,
                            26,
                            26,
                            26,
                            27,
                            27,
                            27,
                            27,
                            28,
                            28,
                            28,
                            28,
                            29,
                            29,
                            29,
                            29,
                            30,
                            30,
                            30,
                            30,
                            31,
                            31,
                            31,
                            31,
                            32,
                            32,
                            32,
                            32,
                            33,
                            33,
                            33,
                            33,
                            34,
                            34,
                            34,
                            34,
                            35,
                            35,
                            35,
                            35,
                            36,
                            36,
                            36,
                            36,
                            37,
                            37,
                            37,
                            37,
                            38,
                            38,
                            38,
                            38,
                            39,
                            39,
                            39,
                            39,
                            40,
                            40,
                            40,
                            40,
                            41,
                            41,
                            41,
                            41,
                            42,
                            42,
                            42,
                            42,
                            43,
                            43,
                            43,
                            43,
                            44,
                            44,
                            44,
                            44,
                            45,
                            45,
                            45,
                            45,
                            46,
                            46,
                            46,
                            46,
                            47,
                            47,
                            47,
                            47,
                            48,
                            48,
                            48,
                            48,
                            49,
                            49,
                            49,
                            49,
                            50,
                            50,
                            50,
                            50,
                            51,
                            51,
                            51,
                            51,
                            52,
                            52,
                            52,
                            52,
                            53,
                            53,
                            53,
                            53,
                            54,
                            54,
                            54,
                            54,
                            55,
                            55,
                            55,
                            55,
                            56,
                            56,
                            56,
                            56,
                            57,
                            57,
                            57,
                            57,
                            58,
                            58,
                            58,
                            58,
                            59,
                            59,
                            59,
                            59,
                            60,
                            60,
                            60,
                            60,
                            61,
                            61,
                            61,
                            61,
                            62,
                            62,
                            62,
                            62,
                            63,
                            63,
                            63,
                            63,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                        ])),
                            (r.lookupOffsets = new Uint16Array([1024, 1536, 1280, 1536, 0, 256, 768, 512]));
                    },
                    "dec/decode.js": function (e, t, r) {
                        function n(e) {
                            var t;
                            return 0 === e.readBits(1) ? 16 : ((t = e.readBits(3)), t > 0 ? 17 + t : ((t = e.readBits(3)), t > 0 ? 8 + t : 17));
                        }
                        function o(e) {
                            if (e.readBits(1)) {
                                var t = e.readBits(3);
                                return 0 === t ? 1 : e.readBits(t) + (1 << t);
                            }
                            return 0;
                        }
                        function a() {
                            (this.meta_block_length = 0), (this.input_end = 0), (this.is_uncompressed = 0), (this.is_metadata = !1);
                        }
                        function i(e) {
                            var t,
                                r,
                                n,
                                o = new a();
                            if (((o.input_end = e.readBits(1)), o.input_end && e.readBits(1))) return o;
                            if (((t = e.readBits(2) + 4), 7 === t)) {
                                if (((o.is_metadata = !0), 0 !== e.readBits(1))) throw new Error("Invalid reserved bit");
                                if (((r = e.readBits(2)), 0 === r)) return o;
                                for (n = 0; n < r; n++) {
                                    var i = e.readBits(8);
                                    if (n + 1 === r && r > 1 && 0 === i) throw new Error("Invalid size byte");
                                    o.meta_block_length |= i << (8 * n);
                                }
                            } else
                                for (n = 0; n < t; ++n) {
                                    var s = e.readBits(4);
                                    if (n + 1 === t && t > 4 && 0 === s) throw new Error("Invalid size nibble");
                                    o.meta_block_length |= s << (4 * n);
                                }
                            return ++o.meta_block_length, o.input_end || o.is_metadata || (o.is_uncompressed = e.readBits(1)), o;
                        }
                        function s(e, t, r) {
                            var n;
                            return (
                                r.fillBitWindow(),
                                (t += (r.val_ >>> r.bit_pos_) & D),
                                (n = e[t].bits - P),
                                n > 0 && ((r.bit_pos_ += P), (t += e[t].value), (t += (r.val_ >>> r.bit_pos_) & ((1 << n) - 1))),
                                (r.bit_pos_ += e[t].bits),
                                e[t].value
                            );
                        }
                        function d(e, t, r, n) {
                            for (var o = 0, a = N, i = 0, s = 0, d = 32768, l = [], u = 0; u < 32; u++) l.push(new B(0, 0));
                            for (L(l, 0, 5, e, q); o < t && d > 0; ) {
                                var f,
                                    c = 0;
                                if ((n.readMoreInput(), n.fillBitWindow(), (c += (n.val_ >>> n.bit_pos_) & 31), (n.bit_pos_ += l[c].bits), (f = 255 & l[c].value), f < R)) (i = 0), (r[o++] = f), 0 !== f && ((a = f), (d -= 32768 >> f));
                                else {
                                    var h,
                                        p,
                                        w = f - 14,
                                        m = 0;
                                    if ((f === R && (m = a), s !== m && ((i = 0), (s = m)), (h = i), i > 0 && ((i -= 2), (i <<= w)), (i += n.readBits(w) + 3), (p = i - h), o + p > t))
                                        throw new Error("[ReadHuffmanCodeLengths] symbol + repeat_delta > num_symbols");
                                    for (var b = 0; b < p; b++) r[o + b] = s;
                                    (o += p), 0 !== s && (d -= p << (15 - s));
                                }
                            }
                            if (0 !== d) throw new Error("[ReadHuffmanCodeLengths] space = " + d);
                            for (; o < t; o++) r[o] = 0;
                        }
                        function l(e, t, r, n) {
                            var o,
                                a = 0,
                                i = new Uint8Array(e);
                            if ((n.readMoreInput(), (o = n.readBits(2)), 1 === o)) {
                                for (var s, l = e - 1, u = 0, f = new Int32Array(4), c = n.readBits(2) + 1; l; ) (l >>= 1), ++u;
                                for (s = 0; s < c; ++s) (f[s] = n.readBits(u) % e), (i[f[s]] = 2);
                                switch (((i[f[0]] = 1), c)) {
                                    case 1:
                                        break;
                                    case 3:
                                        if (f[0] === f[1] || f[0] === f[2] || f[1] === f[2]) throw new Error("[ReadHuffmanCode] invalid symbols");
                                        break;
                                    case 2:
                                        if (f[0] === f[1]) throw new Error("[ReadHuffmanCode] invalid symbols");
                                        i[f[1]] = 1;
                                        break;
                                    case 4:
                                        if (f[0] === f[1] || f[0] === f[2] || f[0] === f[3] || f[1] === f[2] || f[1] === f[3] || f[2] === f[3]) throw new Error("[ReadHuffmanCode] invalid symbols");
                                        n.readBits(1) ? ((i[f[2]] = 3), (i[f[3]] = 3)) : (i[f[0]] = 2);
                                }
                            } else {
                                var s,
                                    h = new Uint8Array(q),
                                    p = 32,
                                    w = 0,
                                    m = [
                                        new B(2, 0),
                                        new B(2, 4),
                                        new B(2, 3),
                                        new B(3, 2),
                                        new B(2, 0),
                                        new B(2, 4),
                                        new B(2, 3),
                                        new B(4, 1),
                                        new B(2, 0),
                                        new B(2, 4),
                                        new B(2, 3),
                                        new B(3, 2),
                                        new B(2, 0),
                                        new B(2, 4),
                                        new B(2, 3),
                                        new B(4, 5),
                                    ];
                                for (s = o; s < q && p > 0; ++s) {
                                    var b,
                                        y = V[s],
                                        g = 0;
                                    n.fillBitWindow(), (g += (n.val_ >>> n.bit_pos_) & 15), (n.bit_pos_ += m[g].bits), (b = m[g].value), (h[y] = b), 0 !== b && ((p -= 32 >> b), ++w);
                                }
                                if (1 !== w && 0 !== p) throw new Error("[ReadHuffmanCode] invalid num_codes or space");
                                d(h, e, i, n);
                            }
                            if (((a = L(t, r, P, i, e)), 0 === a)) throw new Error("[ReadHuffmanCode] BuildHuffmanTable failed: ");
                            return a;
                        }
                        function u(e, t, r) {
                            var n, o;
                            return (n = s(e, t, r)), (o = O.kBlockLengthPrefixCode[n].nbits), O.kBlockLengthPrefixCode[n].offset + r.readBits(o);
                        }
                        function f(e, t, r) {
                            var n;
                            return e < Z ? ((r += Y[e]), (r &= 3), (n = t[r] + z[e])) : (n = e - Z + 1), n;
                        }
                        function c(e, t) {
                            for (var r = e[t], n = t; n; --n) e[n] = e[n - 1];
                            e[0] = r;
                        }
                        function h(e, t) {
                            var r,
                                n = new Uint8Array(256);
                            for (r = 0; r < 256; ++r) n[r] = r;
                            for (r = 0; r < t; ++r) {
                                var o = e[r];
                                (e[r] = n[o]), o && c(n, o);
                            }
                        }
                        function p(e, t) {
                            (this.alphabet_size = e), (this.num_htrees = t), (this.codes = new Array(t + t * G[(e + 31) >>> 5])), (this.htrees = new Uint32Array(t));
                        }
                        function w(e, t) {
                            var r,
                                n,
                                a,
                                i = { num_htrees: null, context_map: null },
                                d = 0;
                            t.readMoreInput();
                            var u = (i.num_htrees = o(t) + 1),
                                f = (i.context_map = new Uint8Array(e));
                            if (u <= 1) return i;
                            for (r = t.readBits(1), r && (d = t.readBits(4) + 1), n = [], a = 0; a < F; a++) n[a] = new B(0, 0);
                            for (l(u + d, n, 0, t), a = 0; a < e; ) {
                                var c;
                                if ((t.readMoreInput(), (c = s(n, 0, t)), 0 === c)) (f[a] = 0), ++a;
                                else if (c <= d)
                                    for (var p = 1 + (1 << c) + t.readBits(c); --p; ) {
                                        if (a >= e) throw new Error("[DecodeContextMap] i >= context_map_size");
                                        (f[a] = 0), ++a;
                                    }
                                else (f[a] = c - d), ++a;
                            }
                            return t.readBits(1) && h(f, e), i;
                        }
                        function m(e, t, r, n, o, a, i) {
                            var d,
                                l = 2 * r,
                                u = r,
                                f = s(t, r * F, i);
                            (d = 0 === f ? o[l + (1 & a[u])] : 1 === f ? o[l + ((a[u] - 1) & 1)] + 1 : f - 2), d >= e && (d -= e), (n[r] = d), (o[l + (1 & a[u])] = d), ++a[u];
                        }
                        function b(e, t, r, n, o, a) {
                            var i,
                                s = o + 1,
                                d = r & o,
                                l = a.pos_ & E.IBUF_MASK;
                            if (t < 8 || a.bit_pos_ + (t << 3) < a.bit_end_pos_) for (; t-- > 0; ) a.readMoreInput(), (n[d++] = a.readBits(8)), d === s && (e.write(n, s), (d = 0));
                            else {
                                if (a.bit_end_pos_ < 32) throw new Error("[CopyUncompressedBlockToOutput] br.bit_end_pos_ < 32");
                                for (; a.bit_pos_ < 32; ) (n[d] = a.val_ >>> a.bit_pos_), (a.bit_pos_ += 8), ++d, --t;
                                if (((i = (a.bit_end_pos_ - a.bit_pos_) >> 3), l + i > E.IBUF_MASK)) {
                                    for (var u = E.IBUF_MASK + 1 - l, f = 0; f < u; f++) n[d + f] = a.buf_[l + f];
                                    (i -= u), (d += u), (t -= u), (l = 0);
                                }
                                for (var f = 0; f < i; f++) n[d + f] = a.buf_[l + f];
                                if (((d += i), (t -= i), d >= s)) {
                                    e.write(n, s), (d -= s);
                                    for (var f = 0; f < d; f++) n[f] = n[s + f];
                                }
                                for (; d + t >= s; ) {
                                    if (((i = s - d), a.input_.read(n, d, i) < i)) throw new Error("[CopyUncompressedBlockToOutput] not enough bytes");
                                    e.write(n, s), (t -= i), (d = 0);
                                }
                                if (a.input_.read(n, d, t) < t) throw new Error("[CopyUncompressedBlockToOutput] not enough bytes");
                                a.reset();
                            }
                        }
                        function y(e) {
                            var t = (e.bit_pos_ + 7) & -8,
                                r = e.readBits(t - e.bit_pos_);
                            return 0 == r;
                        }
                        function g(e) {
                            var t = new U(e),
                                r = new E(t);
                            n(r);
                            var o = i(r);
                            return o.meta_block_length;
                        }
                        function v(e, t) {
                            var r = new U(e);
                            null == t && (t = g(e));
                            var n = new Uint8Array(t),
                                o = new x(n);
                            return A(r, o), o.pos < o.buffer.length && (o.buffer = o.buffer.subarray(0, o.pos)), o.buffer;
                        }
                        function A(e, t) {
                            var r,
                                a,
                                d,
                                c,
                                h,
                                g,
                                v,
                                A,
                                U,
                                x = 0,
                                L = 0,
                                N = 0,
                                R = 0,
                                P = [16, 15, 11, 4],
                                D = 0,
                                q = 0,
                                V = 0,
                                Y = [new p(0, 0), new p(0, 0), new p(0, 0)];
                            const z = 128 + E.READ_SIZE;
                            (U = new E(e)), (N = n(U)), (a = (1 << N) - 16), (d = 1 << N), (c = d - 1), (h = new Uint8Array(d + z + k.maxDictionaryWordLength)), (g = d), (v = []), (A = []);
                            for (var G = 0; G < 3240; G++) (v[G] = new B(0, 0)), (A[G] = new B(0, 0));
                            for (; !L; ) {
                                var J,
                                    j,
                                    X,
                                    K,
                                    Q,
                                    _,
                                    $,
                                    ee,
                                    te,
                                    re = 0,
                                    ne = [1 << 28, 1 << 28, 1 << 28],
                                    oe = [0],
                                    ae = [1, 1, 1],
                                    ie = [0, 1, 0, 1, 0, 1],
                                    se = [0],
                                    de = null,
                                    le = null,
                                    ue = null,
                                    fe = 0,
                                    ce = null,
                                    he = 0,
                                    pe = 0,
                                    we = null,
                                    me = 0,
                                    be = 0,
                                    ye = 0;
                                for (r = 0; r < 3; ++r) (Y[r].codes = null), (Y[r].htrees = null);
                                U.readMoreInput();
                                var ge = i(U);
                                if (((re = ge.meta_block_length), x + re > t.buffer.length)) {
                                    var ve = new Uint8Array(x + re);
                                    ve.set(t.buffer), (t.buffer = ve);
                                }
                                if (((L = ge.input_end), (J = ge.is_uncompressed), ge.is_metadata)) for (y(U); re > 0; --re) U.readMoreInput(), U.readBits(8);
                                else if (0 !== re)
                                    if (J) (U.bit_pos_ = (U.bit_pos_ + 7) & -8), b(t, re, x, h, c, U), (x += re);
                                    else {
                                        for (r = 0; r < 3; ++r) (ae[r] = o(U) + 1), ae[r] >= 2 && (l(ae[r] + 2, v, r * F, U), l(S, A, r * F, U), (ne[r] = u(A, r * F, U)), (se[r] = 1));
                                        for (U.readMoreInput(), j = U.readBits(2), X = Z + (U.readBits(4) << j), K = (1 << j) - 1, Q = X + (48 << j), le = new Uint8Array(ae[0]), r = 0; r < ae[0]; ++r)
                                            U.readMoreInput(), (le[r] = U.readBits(2) << 1);
                                        var Ae = w(ae[0] << T, U);
                                        (_ = Ae.num_htrees), (de = Ae.context_map);
                                        var Ue = w(ae[2] << I, U);
                                        for ($ = Ue.num_htrees, ue = Ue.context_map, Y[0] = new p(C, _), Y[1] = new p(H, ae[1]), Y[2] = new p(Q, $), r = 0; r < 3; ++r) Y[r].decode(U);
                                        for (ce = 0, we = 0, ee = le[oe[0]], be = W.lookupOffsets[ee], ye = W.lookupOffsets[ee + 1], te = Y[1].htrees[0]; re > 0; ) {
                                            var xe, Ee, ke, Be, Le, We, Oe, Me, Ne, Re, Ce;
                                            for (
                                                U.readMoreInput(),
                                                    0 === ne[1] && (m(ae[1], v, 1, oe, ie, se, U), (ne[1] = u(A, F, U)), (te = Y[1].htrees[oe[1]])),
                                                    --ne[1],
                                                    xe = s(Y[1].codes, te, U),
                                                    Ee = xe >> 6,
                                                    Ee >= 2 ? ((Ee -= 2), (Oe = -1)) : (Oe = 0),
                                                    ke = O.kInsertRangeLut[Ee] + ((xe >> 3) & 7),
                                                    Be = O.kCopyRangeLut[Ee] + (7 & xe),
                                                    Le = O.kInsertLengthPrefixCode[ke].offset + U.readBits(O.kInsertLengthPrefixCode[ke].nbits),
                                                    We = O.kCopyLengthPrefixCode[Be].offset + U.readBits(O.kCopyLengthPrefixCode[Be].nbits),
                                                    q = h[(x - 1) & c],
                                                    V = h[(x - 2) & c],
                                                    Re = 0;
                                                Re < Le;
                                                ++Re
                                            )
                                                U.readMoreInput(),
                                                    0 === ne[0] && (m(ae[0], v, 0, oe, ie, se, U), (ne[0] = u(A, 0, U)), (fe = oe[0] << T), (ce = fe), (ee = le[oe[0]]), (be = W.lookupOffsets[ee]), (ye = W.lookupOffsets[ee + 1])),
                                                    (Ne = W.lookup[be + q] | W.lookup[ye + V]),
                                                    (he = de[ce + Ne]),
                                                    --ne[0],
                                                    (V = q),
                                                    (q = s(Y[0].codes, Y[0].htrees[he], U)),
                                                    (h[x & c] = q),
                                                    (x & c) === c && t.write(h, d),
                                                    ++x;
                                            if (((re -= Le), re <= 0)) break;
                                            if (Oe < 0) {
                                                var Ne;
                                                if (
                                                    (U.readMoreInput(),
                                                    0 === ne[2] && (m(ae[2], v, 2, oe, ie, se, U), (ne[2] = u(A, 2160, U)), (pe = oe[2] << I), (we = pe)),
                                                    --ne[2],
                                                    (Ne = 255 & (We > 4 ? 3 : We - 2)),
                                                    (me = ue[we + Ne]),
                                                    (Oe = s(Y[2].codes, Y[2].htrees[me], U)),
                                                    Oe >= X)
                                                ) {
                                                    var He, Se, Te;
                                                    (Oe -= X), (Se = Oe & K), (Oe >>= j), (He = (Oe >> 1) + 1), (Te = ((2 + (1 & Oe)) << He) - 4), (Oe = X + ((Te + U.readBits(He)) << j) + Se);
                                                }
                                            }
                                            if (((Me = f(Oe, P, D)), Me < 0)) throw new Error("[BrotliDecompress] invalid distance");
                                            if (((R = x < a && R !== a ? x : a), (Ce = x & c), Me > R)) {
                                                if (!(We >= k.minDictionaryWordLength && We <= k.maxDictionaryWordLength)) throw new Error("Invalid backward reference. pos: " + x + " distance: " + Me + " len: " + We + " bytes left: " + re);
                                                var Te = k.offsetsByLength[We],
                                                    Ie = Me - R - 1,
                                                    Pe = k.sizeBitsByLength[We],
                                                    De = (1 << Pe) - 1,
                                                    Fe = Ie & De,
                                                    qe = Ie >> Pe;
                                                if (((Te += Fe * We), !(qe < M.kNumTransforms))) throw new Error("Invalid backward reference. pos: " + x + " distance: " + Me + " len: " + We + " bytes left: " + re);
                                                var Ve = M.transformDictionaryWord(h, Ce, Te, We, qe);
                                                if (((Ce += Ve), (x += Ve), (re -= Ve), Ce >= g)) {
                                                    t.write(h, d);
                                                    for (var Ze = 0; Ze < Ce - g; Ze++) h[Ze] = h[g + Ze];
                                                }
                                            } else {
                                                if ((Oe > 0 && ((P[3 & D] = Me), ++D), We > re)) throw new Error("Invalid backward reference. pos: " + x + " distance: " + Me + " len: " + We + " bytes left: " + re);
                                                for (Re = 0; Re < We; ++Re) (h[x & c] = h[(x - Me) & c]), (x & c) === c && t.write(h, d), ++x, --re;
                                            }
                                            (q = h[(x - 1) & c]), (V = h[(x - 2) & c]);
                                        }
                                        x &= 1073741823;
                                    }
                            }
                            t.write(h, x & c);
                        }
                        var U = e("./streams").BrotliInput,
                            x = e("./streams").BrotliOutput,
                            E = e("./bit_reader"),
                            k = e("./dictionary"),
                            B = e("./huffman").HuffmanCode,
                            L = e("./huffman").BrotliBuildHuffmanTable,
                            W = e("./context"),
                            O = e("./prefix"),
                            M = e("./transform");
                        const N = 8,
                            R = 16,
                            C = 256,
                            H = 704,
                            S = 26,
                            T = 6,
                            I = 2,
                            P = 8,
                            D = 255,
                            F = 1080,
                            q = 18,
                            V = new Uint8Array([1, 2, 3, 4, 0, 5, 17, 6, 16, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
                            Z = 16,
                            Y = new Uint8Array([3, 2, 1, 0, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2]),
                            z = new Int8Array([0, 0, 0, 0, -1, 1, -2, 2, -3, 3, -1, 1, -2, 2, -3, 3]),
                            G = new Uint16Array([256, 402, 436, 468, 500, 534, 566, 598, 630, 662, 694, 726, 758, 790, 822, 854, 886, 920, 952, 984, 1016, 1048, 1080]);
                        (p.prototype.decode = function (e) {
                            var t,
                                r,
                                n = 0;
                            for (t = 0; t < this.num_htrees; ++t) (this.htrees[t] = n), (r = l(this.alphabet_size, this.codes, n, e)), (n += r);
                        }),
                            (r.BrotliDecompressedSize = g),
                            (r.BrotliDecompressBuffer = v),
                            (r.BrotliDecompress = A),
                            k.init();
                    },
                    "dec/dictionary.js": function (e, t, r) {
                        var n = e("./dictionary-browser");
                        (r.init = function () {
                            r.dictionary = n.init();
                        }),
                            (r.offsetsByLength = new Uint32Array([0, 0, 0, 0, 0, 4096, 9216, 21504, 35840, 44032, 53248, 63488, 74752, 87040, 93696, 100864, 104704, 106752, 108928, 113536, 115968, 118528, 119872, 121280, 122016])),
                            (r.sizeBitsByLength = new Uint8Array([0, 0, 0, 0, 10, 10, 11, 11, 10, 10, 10, 10, 10, 9, 9, 8, 7, 7, 8, 7, 7, 6, 6, 5, 5])),
                            (r.minDictionaryWordLength = 4),
                            (r.maxDictionaryWordLength = 24);
                    },
                    "dec/dictionary.bin.js": function (e, t, r) {
                        t.exports =
                            "";
                    },
                    "dec/dictionary-browser.js": function (e, t, r) {
                        var n = e("base64-js");
                        r.init = function () {
                            var t = e("./decode").BrotliDecompressBuffer,
                                r = n.toByteArray(e("./dictionary.bin.js"));
                            return t(r);
                        };
                    },
                    "dec/huffman.js": function (e, t, r) {
                        function n(e, t) {
                            (this.bits = e), (this.value = t);
                        }
                        function o(e, t) {
                            for (var r = 1 << (t - 1); e & r; ) r >>= 1;
                            return (e & (r - 1)) + r;
                        }
                        function a(e, t, r, o, a) {
                            do (o -= r), (e[t + o] = new n(a.bits, a.value));
                            while (o > 0);
                        }
                        function i(e, t, r) {
                            for (var n = 1 << (t - r); t < s && ((n -= e[t]), !(n <= 0)); ) ++t, (n <<= 1);
                            return t - r;
                        }
                        r.HuffmanCode = n;
                        const s = 15;
                        r.BrotliBuildHuffmanTable = function (e, t, r, d, l) {
                            var u,
                                f,
                                c,
                                h,
                                p,
                                w,
                                m,
                                b,
                                y,
                                g,
                                v,
                                A = t,
                                U = new Int32Array(16),
                                x = new Int32Array(16);
                            for (v = new Int32Array(l), c = 0; c < l; c++) U[d[c]]++;
                            for (x[1] = 0, f = 1; f < s; f++) x[f + 1] = x[f] + U[f];
                            for (c = 0; c < l; c++) 0 !== d[c] && (v[x[d[c]]++] = c);
                            if (((b = r), (y = 1 << b), (g = y), 1 === x[s])) {
                                for (h = 0; h < g; ++h) e[t + h] = new n(0, 65535 & v[0]);
                                return g;
                            }
                            for (h = 0, c = 0, f = 1, p = 2; f <= r; ++f, p <<= 1) for (; U[f] > 0; --U[f]) (u = new n(255 & f, 65535 & v[c++])), a(e, t + h, p, y, u), (h = o(h, f));
                            for (m = g - 1, w = -1, f = r + 1, p = 2; f <= s; ++f, p <<= 1)
                                for (; U[f] > 0; --U[f])
                                    (h & m) !== w && ((t += y), (b = i(U, f, r)), (y = 1 << b), (g += y), (w = h & m), (e[A + w] = new n((b + r) & 255, (t - A - w) & 65535))),
                                        (u = new n((f - r) & 255, 65535 & v[c++])),
                                        a(e, t + (h >> r), p, y, u),
                                        (h = o(h, f));
                            return g;
                        };
                    },
                    "dec/prefix.js": function (e, t, r) {
                        function n(e, t) {
                            (this.offset = e), (this.nbits = t);
                        }
                        (r.kBlockLengthPrefixCode = [
                            new n(1, 2),
                            new n(5, 2),
                            new n(9, 2),
                            new n(13, 2),
                            new n(17, 3),
                            new n(25, 3),
                            new n(33, 3),
                            new n(41, 3),
                            new n(49, 4),
                            new n(65, 4),
                            new n(81, 4),
                            new n(97, 4),
                            new n(113, 5),
                            new n(145, 5),
                            new n(177, 5),
                            new n(209, 5),
                            new n(241, 6),
                            new n(305, 6),
                            new n(369, 7),
                            new n(497, 8),
                            new n(753, 9),
                            new n(1265, 10),
                            new n(2289, 11),
                            new n(4337, 12),
                            new n(8433, 13),
                            new n(16625, 24),
                        ]),
                            (r.kInsertLengthPrefixCode = [
                                new n(0, 0),
                                new n(1, 0),
                                new n(2, 0),
                                new n(3, 0),
                                new n(4, 0),
                                new n(5, 0),
                                new n(6, 1),
                                new n(8, 1),
                                new n(10, 2),
                                new n(14, 2),
                                new n(18, 3),
                                new n(26, 3),
                                new n(34, 4),
                                new n(50, 4),
                                new n(66, 5),
                                new n(98, 5),
                                new n(130, 6),
                                new n(194, 7),
                                new n(322, 8),
                                new n(578, 9),
                                new n(1090, 10),
                                new n(2114, 12),
                                new n(6210, 14),
                                new n(22594, 24),
                            ]),
                            (r.kCopyLengthPrefixCode = [
                                new n(2, 0),
                                new n(3, 0),
                                new n(4, 0),
                                new n(5, 0),
                                new n(6, 0),
                                new n(7, 0),
                                new n(8, 0),
                                new n(9, 0),
                                new n(10, 1),
                                new n(12, 1),
                                new n(14, 2),
                                new n(18, 2),
                                new n(22, 3),
                                new n(30, 3),
                                new n(38, 4),
                                new n(54, 4),
                                new n(70, 5),
                                new n(102, 5),
                                new n(134, 6),
                                new n(198, 7),
                                new n(326, 8),
                                new n(582, 9),
                                new n(1094, 10),
                                new n(2118, 24),
                            ]),
                            (r.kInsertRangeLut = [0, 0, 8, 8, 0, 16, 8, 16, 16]),
                            (r.kCopyRangeLut = [0, 8, 0, 8, 16, 0, 16, 8, 16]);
                    },
                    "dec/streams.js": function (e, t, r) {
                        function n(e) {
                            (this.buffer = e), (this.pos = 0);
                        }
                        function o(e) {
                            (this.buffer = e), (this.pos = 0);
                        }
                        (n.prototype.read = function (e, t, r) {
                            this.pos + r > this.buffer.length && (r = this.buffer.length - this.pos);
                            for (var n = 0; n < r; n++) e[t + n] = this.buffer[this.pos + n];
                            return (this.pos += r), r;
                        }),
                            (r.BrotliInput = n),
                            (o.prototype.write = function (e, t) {
                                if (this.pos + t > this.buffer.length) throw new Error("Output buffer is not large enough");
                                return this.buffer.set(e.subarray(0, t), this.pos), (this.pos += t), t;
                            }),
                            (r.BrotliOutput = o);
                    },
                    "dec/transform.js": function (e, t, r) {
                        function n(e, t, r) {
                            (this.prefix = new Uint8Array(e.length)), (this.transform = t), (this.suffix = new Uint8Array(r.length));
                            for (var n = 0; n < e.length; n++) this.prefix[n] = e.charCodeAt(n);
                            for (var n = 0; n < r.length; n++) this.suffix[n] = r.charCodeAt(n);
                        }
                        function o(e, t) {
                            return e[t] < 192 ? (e[t] >= 97 && e[t] <= 122 && (e[t] ^= 32), 1) : e[t] < 224 ? ((e[t + 1] ^= 32), 2) : ((e[t + 2] ^= 5), 3);
                        }
                        var a = e("./dictionary");
                        const i = 0,
                            s = 1,
                            d = 2,
                            l = 3,
                            u = 4,
                            f = 5,
                            c = 6,
                            h = 7,
                            p = 8,
                            w = 9,
                            m = 10,
                            b = 11,
                            y = 12,
                            g = 13,
                            v = 14,
                            A = 15,
                            U = 16,
                            x = 17,
                            E = 18,
                            k = 20;
                        var B = [
                            new n("", i, ""),
                            new n("", i, " "),
                            new n(" ", i, " "),
                            new n("", y, ""),
                            new n("", m, " "),
                            new n("", i, " the "),
                            new n(" ", i, ""),
                            new n("s ", i, " "),
                            new n("", i, " of "),
                            new n("", m, ""),
                            new n("", i, " and "),
                            new n("", g, ""),
                            new n("", s, ""),
                            new n(", ", i, " "),
                            new n("", i, ", "),
                            new n(" ", m, " "),
                            new n("", i, " in "),
                            new n("", i, " to "),
                            new n("e ", i, " "),
                            new n("", i, '"'),
                            new n("", i, "."),
                            new n("", i, '">'),
                            new n("", i, "\n"),
                            new n("", l, ""),
                            new n("", i, "]"),
                            new n("", i, " for "),
                            new n("", v, ""),
                            new n("", d, ""),
                            new n("", i, " a "),
                            new n("", i, " that "),
                            new n(" ", m, ""),
                            new n("", i, ". "),
                            new n(".", i, ""),
                            new n(" ", i, ", "),
                            new n("", A, ""),
                            new n("", i, " with "),
                            new n("", i, "'"),
                            new n("", i, " from "),
                            new n("", i, " by "),
                            new n("", U, ""),
                            new n("", x, ""),
                            new n(" the ", i, ""),
                            new n("", u, ""),
                            new n("", i, ". The "),
                            new n("", b, ""),
                            new n("", i, " on "),
                            new n("", i, " as "),
                            new n("", i, " is "),
                            new n("", h, ""),
                            new n("", s, "ing "),
                            new n("", i, "\n\t"),
                            new n("", i, ":"),
                            new n(" ", i, ". "),
                            new n("", i, "ed "),
                            new n("", k, ""),
                            new n("", E, ""),
                            new n("", c, ""),
                            new n("", i, "("),
                            new n("", m, ", "),
                            new n("", p, ""),
                            new n("", i, " at "),
                            new n("", i, "ly "),
                            new n(" the ", i, " of "),
                            new n("", f, ""),
                            new n("", w, ""),
                            new n(" ", m, ", "),
                            new n("", m, '"'),
                            new n(".", i, "("),
                            new n("", b, " "),
                            new n("", m, '">'),
                            new n("", i, '="'),
                            new n(" ", i, "."),
                            new n(".com/", i, ""),
                            new n(" the ", i, " of the "),
                            new n("", m, "'"),
                            new n("", i, ". This "),
                            new n("", i, ","),
                            new n(".", i, " "),
                            new n("", m, "("),
                            new n("", m, "."),
                            new n("", i, " not "),
                            new n(" ", i, '="'),
                            new n("", i, "er "),
                            new n(" ", b, " "),
                            new n("", i, "al "),
                            new n(" ", b, ""),
                            new n("", i, "='"),
                            new n("", b, '"'),
                            new n("", m, ". "),
                            new n(" ", i, "("),
                            new n("", i, "ful "),
                            new n(" ", m, ". "),
                            new n("", i, "ive "),
                            new n("", i, "less "),
                            new n("", b, "'"),
                            new n("", i, "est "),
                            new n(" ", m, "."),
                            new n("", b, '">'),
                            new n(" ", i, "='"),
                            new n("", m, ","),
                            new n("", i, "ize "),
                            new n("", b, "."),
                            new n("\xc2\xa0", i, ""),
                            new n(" ", i, ","),
                            new n("", m, '="'),
                            new n("", b, '="'),
                            new n("", i, "ous "),
                            new n("", b, ", "),
                            new n("", m, "='"),
                            new n(" ", m, ","),
                            new n(" ", b, '="'),
                            new n(" ", b, ", "),
                            new n("", b, ","),
                            new n("", b, "("),
                            new n("", b, ". "),
                            new n(" ", b, "."),
                            new n("", b, "='"),
                            new n(" ", b, ". "),
                            new n(" ", m, '="'),
                            new n(" ", b, "='"),
                            new n(" ", m, "='"),
                        ];
                        (r.kTransforms = B),
                            (r.kNumTransforms = B.length),
                            (r.transformDictionaryWord = function (e, t, r, n, i) {
                                var s,
                                    d = B[i].prefix,
                                    l = B[i].suffix,
                                    u = B[i].transform,
                                    f = u < y ? 0 : u - 11,
                                    c = 0,
                                    h = t;
                                f > n && (f = n);
                                for (var p = 0; p < d.length; ) e[t++] = d[p++];
                                for (r += f, n -= f, u <= w && (n -= u), c = 0; c < n; c++) e[t++] = a.dictionary[r + c];
                                if (((s = t - n), u === m)) o(e, s);
                                else if (u === b)
                                    for (; n > 0; ) {
                                        var g = o(e, s);
                                        (s += g), (n -= g);
                                    }
                                for (var v = 0; v < l.length; ) e[t++] = l[v++];
                                return t - h;
                            });
                    },
                    "node_modules/base64-js/index.js": function (e, t, r) {
                        "use strict";
                        function n(e) {
                            var t = e.length;
                            if (t % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
                            return "=" === e[t - 2] ? 2 : "=" === e[t - 1] ? 1 : 0;
                        }
                        function o(e) {
                            return (3 * e.length) / 4 - n(e);
                        }
                        function a(e) {
                            var t,
                                r,
                                o,
                                a,
                                i,
                                s,
                                d = e.length;
                            (i = n(e)), (s = new f((3 * d) / 4 - i)), (o = i > 0 ? d - 4 : d);
                            var l = 0;
                            for (t = 0, r = 0; t < o; t += 4, r += 3)
                                (a = (u[e.charCodeAt(t)] << 18) | (u[e.charCodeAt(t + 1)] << 12) | (u[e.charCodeAt(t + 2)] << 6) | u[e.charCodeAt(t + 3)]), (s[l++] = (a >> 16) & 255), (s[l++] = (a >> 8) & 255), (s[l++] = 255 & a);
                            return (
                                2 === i
                                    ? ((a = (u[e.charCodeAt(t)] << 2) | (u[e.charCodeAt(t + 1)] >> 4)), (s[l++] = 255 & a))
                                    : 1 === i && ((a = (u[e.charCodeAt(t)] << 10) | (u[e.charCodeAt(t + 1)] << 4) | (u[e.charCodeAt(t + 2)] >> 2)), (s[l++] = (a >> 8) & 255), (s[l++] = 255 & a)),
                                s
                            );
                        }
                        function i(e) {
                            return l[(e >> 18) & 63] + l[(e >> 12) & 63] + l[(e >> 6) & 63] + l[63 & e];
                        }
                        function s(e, t, r) {
                            for (var n, o = [], a = t; a < r; a += 3) (n = (e[a] << 16) + (e[a + 1] << 8) + e[a + 2]), o.push(i(n));
                            return o.join("");
                        }
                        function d(e) {
                            for (var t, r = e.length, n = r % 3, o = "", a = [], i = 16383, d = 0, u = r - n; d < u; d += i) a.push(s(e, d, d + i > u ? u : d + i));
                            return (
                                1 === n
                                    ? ((t = e[r - 1]), (o += l[t >> 2]), (o += l[(t << 4) & 63]), (o += "=="))
                                    : 2 === n && ((t = (e[r - 2] << 8) + e[r - 1]), (o += l[t >> 10]), (o += l[(t >> 4) & 63]), (o += l[(t << 2) & 63]), (o += "=")),
                                a.push(o),
                                a.join("")
                            );
                        }
                        (r.byteLength = o), (r.toByteArray = a), (r.fromByteArray = d);
                        for (var l = [], u = [], f = "undefined" != typeof Uint8Array ? Uint8Array : Array, c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", h = 0, p = c.length; h < p; ++h)
                            (l[h] = c[h]), (u[c.charCodeAt(h)] = h);
                        (u["-".charCodeAt(0)] = 62), (u["_".charCodeAt(0)] = 63);
                    },
                };
                for (var r in t) t[r].folder = r.substring(0, r.lastIndexOf("/") + 1);
                var n = function (e) {
                        var r = [];
                        return (
                            (e = e.split("/").every(function (e) {
                                return ".." == e ? r.pop() : "." == e || "" == e || r.push(e);
                            })
                                ? r.join("/")
                                : null),
                            e ? t[e] || t[e + ".js"] || t[e + "/index.js"] : null
                        );
                    },
                    o = function (e, t) {
                        return e ? n(e.folder + "node_modules/" + t) || o(e.parent, t) : null;
                    },
                    a = function (e, t) {
                        var r = t.match(/^\//) ? null : e ? (t.match(/^\.\.?\//) ? n(e.folder + t) : o(e, t)) : n(t);
                        if (!r) throw "module not found: " + t;
                        return r.exports || ((r.parent = e), r(a.bind(null, r), r, (r.exports = {}))), r.exports;
                    };
                return a(null, e);
            },
            decompress: function (e) {
                this.exports || (this.exports = this.require("decompress.js"));
                try {
                    return this.exports(e);
                } catch (e) {}
            },
            hasUnityMarker: function (e) {
                var t = "UnityWeb Compressed Content (brotli)";
                if (!e.length) return !1;
                var r = 1 & e[0] ? (14 & e[0] ? 4 : 7) : 1,
                    n = e[0] & ((1 << r) - 1),
                    o = 1 + ((Math.log(t.length - 1) / Math.log(2)) >> 3);
                if (((commentOffset = (r + 1 + 2 + 1 + 2 + (o << 3) + 7) >> 3), 17 == n || commentOffset > e.length)) return !1;
                for (var a = n + ((6 + (o << 4) + ((t.length - 1) << 6)) << r), i = 0; i < commentOffset; i++, a >>>= 8) if (e[i] != (255 & a)) return !1;
                return String.fromCharCode.apply(null, e.subarray(commentOffset, commentOffset + t.length)) == t;
            },
        },
        decompress: function (e, t) {
            var r = this.gzip.hasUnityMarker(e) ? this.gzip : this.brotli.hasUnityMarker(e) ? this.brotli : this.identity;
            if (
                (this.serverSetupWarningEnabled &&
                    r != this.identity &&
                    (console.log("You can reduce your startup time if you configure your web server to host .unityweb files using " + (r == this.gzip ? "gzip" : "brotli") + " compression."), (this.serverSetupWarningEnabled = !1)),
                "function" != typeof t)
            )
                return r.decompress(e);
            if (!r.worker) {
                var n = URL.createObjectURL(
                    new Blob(
                        [
                            "this.require = ",
                            r.require.toString(),
                            "; this.decompress = ",
                            r.decompress.toString(),
                            "; this.onmessage = ",
                            function (e) {
                                var t = { id: e.data.id, decompressed: this.decompress(e.data.compressed) };
                                postMessage(t, t.decompressed ? [t.decompressed.buffer] : []);
                            }.toString(),
                            "; postMessage({ ready: true });",
                        ],
                        { type: "text/javascript" }
                    )
                );
                (r.worker = new Worker(n)),
                    (r.worker.onmessage = function (e) {
                        return e.data.ready ? void URL.revokeObjectURL(n) : (this.callbacks[e.data.id](e.data.decompressed), void delete this.callbacks[e.data.id]);
                    }),
                    (r.worker.callbacks = {}),
                    (r.worker.nextCallbackId = 0);
            }
            var o = r.worker.nextCallbackId++;
            (r.worker.callbacks[o] = t), r.worker.postMessage({ id: o, compressed: e }, [e.buffer]);
        },
        serverSetupWarningEnabled: !0,
    },
};
