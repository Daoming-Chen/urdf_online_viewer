// 首先导入 THREE 和所需的加载器
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

// 将 THREE 和加载器设置为全局
window.THREE = THREE;
window.STLLoader = STLLoader;
window.OBJLoader = OBJLoader;

console.log("[模块] 开始加载模块");
console.log("[模块] 导入 urdf-viewer-element.js...");

try {
    // 尝试多种导入方式
    let module;
    let importSuccess = false;

    // 方式1: 直接从 esm.sh 导入
    try {
        module = await import("https://esm.sh/urdf-loader@0.12.5/src/urdf-viewer-element.js");
        console.log("[模块] urdf-viewer-element.js 导入成功 (方式1)");
        importSuccess = true;
    } catch (e1) {
        console.warn("[模块] 方式1导入失败，尝试方式2...", e1);

        // 方式2: 从 jsdelivr 导入
        try {
            module = await import("https://cdn.jsdelivr.net/npm/urdf-loader@0.12.5/src/urdf-viewer-element.js");
            console.log("[模块] urdf-viewer-element.js 导入成功 (方式2)");
            importSuccess = true;
        } catch (e2) {
            console.warn("[模块] 方式2导入失败，尝试方式3...", e2);

            // 方式3: 从 unpkg 导入
            try {
                module = await import("https://unpkg.com/urdf-loader@0.12.5/src/urdf-viewer-element.js");
                console.log("[模块] urdf-viewer-element.js 导入成功 (方式3)");
                importSuccess = true;
            } catch (e3) {
                console.error("[模块] 所有导入方式都失败");
                throw e3;
            }
        }
    }

    if (importSuccess && module) {
        console.log("[模块] 导入的模块内容:", Object.keys(module));
        console.log("[模块] 模块的默认导出类型:", typeof module.default);

        // 检查自定义元素是否已定义
        if (!customElements.get("urdf-viewer")) {
            console.log("[模块] 自定义元素未定义，尝试手动注册...");

            // 尝试从模块中获取类并注册
            const UrdfViewerElement = module.default || module.URDFViewerElement || module.UrdfViewerElement || module.URDFViewer;

            if (UrdfViewerElement && typeof UrdfViewerElement === 'function') {
                console.log("[模块] 找到 UrdfViewerElement 类，正在注册...");
                try {
                    customElements.define("urdf-viewer", UrdfViewerElement);
                    console.log("[模块] 自定义元素注册成功");
                } catch (defineError) {
                    console.error("[模块] 注册自定义元素时出错:", defineError);
                    // 可能已经定义过了，继续执行
                }
            } else {
                console.warn("[模块] 无法从模块中找到 UrdfViewerElement 类");
                console.log("[模块] 模块的默认导出:", module.default);
                console.log("[模块] 模块的所有导出:", Object.keys(module));

                // 等待模块自动注册（有些模块会在导入时自动注册）
                console.log("[模块] 等待自定义元素自动注册（最多5秒）...");
                let waited = 0;
                while (!customElements.get("urdf-viewer") && waited < 5000) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    waited += 100;
                }

                if (customElements.get("urdf-viewer")) {
                    console.log("[模块] 自定义元素已自动注册");
                } else {
                    console.error("[模块] 自定义元素仍未注册");
                }
            }
        } else {
            console.log("[模块] 自定义元素已定义");
        }
    }
} catch (error) {
    console.error("[模块] urdf-viewer-element.js 导入失败:", error);
    console.error("[模块] 错误详情:", error.message, error.stack);
    throw error;
}

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
];

const formatAngle = (radian) =>
    `${(radian * DEG).toFixed(1).padStart(7)}°`;

const createJointCard = (jointName, joint) => {
    const card = document.createElement("div");
    card.className = "joint-card joint-card--loading";
    card.dataset.joint = jointName;

    const sliderId = `joint-slider-${jointName.replace(/[^a-zA-Z0-9]/g, '-')}`;
    card.innerHTML = `
      <div class="joint-header">
          <div>
              <div class="joint-name">${jointName}</div>
          </div>
          <div class="joint-meta joint-value">加载中...</div>
      </div>
      <input id="${sliderId}" class="joint-slider" type="range" min="-180" max="180" step="0.5" value="0" />
      <div class="joint-range">
          <span class="joint-lower">-</span>
          <span class="joint-upper">-</span>
      </div>
    `;

    return card;
};

async function waitForRobot(viewer) {
    console.log("[waitForRobot] ========== 开始等待robot加载 ==========");
    console.log("[waitForRobot] viewer对象:", viewer);
    console.log("[waitForRobot] viewer类型:", viewer?.constructor?.name);
    console.log("[waitForRobot] viewer.robot当前值:", viewer.robot);
    console.log("[waitForRobot] viewer是否有robot属性:", "robot" in viewer);
    console.log("[waitForRobot] viewer的所有属性键:", Object.keys(viewer || {}));

    // 检查 viewer 的内部状态
    if (viewer) {
        console.log("[waitForRobot] viewer 内部状态检查:");
        console.log("  - viewer.connected:", viewer.connected);
        console.log("  - viewer.isConnected:", viewer.isConnected);
        console.log("  - viewer.shadowRoot:", viewer.shadowRoot ? "存在" : "不存在");
    }

    if (viewer.robot) {
        console.log("[waitForRobot] ✓ robot已存在，直接返回");
        console.log("[waitForRobot] robot对象:", viewer.robot);
        return viewer.robot;
    }

    console.log("[waitForRobot] robot尚未加载，开始轮询...");
    let pollCount = 0;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.error("[waitForRobot] ❌ 超时！30秒内robot未加载");
            console.error(`[waitForRobot] 已等待 ${elapsed} 秒，轮询 ${pollCount} 次`);
            console.error("[waitForRobot] viewer状态:", {
                robot: viewer.robot,
                robotType: typeof viewer.robot,
                attributes: Array.from(viewer.getAttributeNames()),
                urdf: viewer.getAttribute("urdf"),
                package: viewer.getAttribute("package"),
                connected: viewer.connected,
                isConnected: viewer.isConnected
            });

            // 尝试检查是否有错误信息
            if (viewer.shadowRoot) {
                const errorElements = viewer.shadowRoot.querySelectorAll("*");
                console.error("[waitForRobot] shadowRoot中的元素数量:", errorElements.length);
            }

            reject(new Error("加载 URDF 超时，请检查资源路径。"));
        }, 30000);

        const poll = () => {
            pollCount++;
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

            // 每60帧（约1秒）打印一次
            if (pollCount % 60 === 0) {
                console.log(`[waitForRobot] ⏳ 轮询中... (${pollCount}次, ${elapsed}秒)`);
                console.log("[waitForRobot]   - viewer.robot:", viewer.robot);
                console.log("[waitForRobot]   - viewer.robot类型:", typeof viewer.robot);

                // 检查是否有其他相关属性
                if (viewer._robot !== undefined) {
                    console.log("[waitForRobot]   - viewer._robot:", viewer._robot);
                }
            }

            if (viewer.robot) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[waitForRobot] ✓✓✓ robot加载成功！`);
                console.log(`[waitForRobot]   轮询次数: ${pollCount}, 耗时: ${elapsed}秒`);
                console.log("[waitForRobot]   robot对象:", viewer.robot);
                console.log("[waitForRobot]   robot名称:", viewer.robot?.name);
                clearTimeout(timeout);
                resolve(viewer.robot);
            } else {
                requestAnimationFrame(poll);
            }
        };

        poll();
    });
}

function setupJointsUI(viewer, robot) {
    console.log("[setupJointsUI] ========== 开始设置关节UI ==========");
    console.log("[setupJointsUI] robot对象:", robot);
    console.log("[setupJointsUI] robot.joints:", robot.joints);
    console.log("[setupJointsUI] robot.joints类型:", typeof robot.joints);
    console.log("[setupJointsUI] robot.joints键数量:", Object.keys(robot.joints || {}).length);

    const controlPanel = $(".joint-list");
    console.log("[setupJointsUI] controlPanel元素:", controlPanel);

    if (!controlPanel) {
        console.error("[setupJointsUI] 未找到 .joint-list 元素！");
        return;
    }

    controlPanel.innerHTML = "";

    const allJoints = Object.entries(robot.joints || {});
    console.log("[setupJointsUI] 所有关节数量:", allJoints.length);
    console.log("[setupJointsUI] 所有关节列表:", allJoints.map(([name]) => name));

    const joints = allJoints
        .filter(([, joint]) => {
            const isFixed = joint.jointType === "fixed";
            if (isFixed) {
                console.log(`[setupJointsUI] 跳过固定关节: ${joint.name || "未知"}`);
            }
            return !isFixed;
        })
        .sort(([a], [b]) => a.localeCompare(b));

    console.log("[setupJointsUI] 可调节关节数量:", joints.length);
    console.log("[setupJointsUI] 可调节关节列表:", joints.map(([name]) => name));

    if (!joints.length) {
        console.warn("[setupJointsUI] ⚠️ 未找到可调节的关节");
        controlPanel.innerHTML = `<div class="status">当前 URDF 模型未包含可调节的关节。</div>`;
        return;
    }

    console.log("[setupJointsUI] 开始创建关节卡片...");
    for (const [jointName, joint] of joints) {
        console.log(`[setupJointsUI] 处理关节: ${jointName}`, {
            jointType: joint.jointType,
            angle: joint.angle,
            limit: joint.limit
        });
        const card = createJointCard(jointName, joint);
        controlPanel.appendChild(card);

        const slider = $(".joint-slider", card);
        const lowerLabel = $(".joint-lower", card);
        const upperLabel = $(".joint-upper", card);
        const valueLabel = $(".joint-value", card);

        const lower =
            joint.limit && Number.isFinite(joint.limit.lower)
                ? joint.limit.lower
                : -Math.PI;
        const upper =
            joint.limit && Number.isFinite(joint.limit.upper)
                ? joint.limit.upper
                : Math.PI;

        slider.min = lower * DEG;
        slider.max = upper * DEG;
        slider.step = 0.5;
        slider.value = joint.angle * DEG;

        lowerLabel.textContent = formatAngle(lower);
        upperLabel.textContent = formatAngle(upper);
        valueLabel.textContent = formatAngle(joint.angle);

        slider.addEventListener("input", (event) => {
            const targetAngle = Number(event.target.value) * RAD;
            joint.setJointValue(targetAngle);
            valueLabel.textContent = formatAngle(targetAngle);
        });
    }
    console.log("[setupJointsUI] ✓✓✓ 关节UI设置完成");
}

async function bootstrap() {
    console.log("[bootstrap] 开始初始化");
    console.log("[bootstrap] 当前URL:", window.location.href);
    console.log("[bootstrap] 等待 customElements.whenDefined('urdf-viewer')...");

    try {
        // 添加超时处理，避免无限等待
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("等待 urdf-viewer 定义超时（10秒）")), 10000);
        });

        await Promise.race([
            customElements.whenDefined("urdf-viewer"),
            timeoutPromise
        ]);
        console.log("[bootstrap] urdf-viewer 自定义元素已定义");
    } catch (error) {
        console.error("[bootstrap] 等待 urdf-viewer 定义失败:", error);
        console.error("[bootstrap] 当前已定义的自定义元素:", Array.from(customElements.getNames || (() => [])()));
        console.error("[bootstrap] 检查 urdf-viewer 是否已定义:", customElements.get("urdf-viewer"));
        throw error;
    }

    console.log("[bootstrap] 查找 urdf-viewer 元素...");
    const viewer = $("urdf-viewer");
    console.log("[bootstrap] viewer 元素:", viewer);

    if (!viewer) {
        console.error("[bootstrap] 未找到 urdf-viewer 元素！");
        const status = $(".status");
        status.textContent = "错误：未找到 urdf-viewer 元素";
        return;
    }

    console.log("[bootstrap] viewer 属性:", {
        urdf: viewer.getAttribute("urdf"),
        package: viewer.getAttribute("package"),
        up: viewer.getAttribute("up"),
        displayShadow: viewer.getAttribute("display-shadow"),
        autoRedraw: viewer.getAttribute("auto-redraw"),
        ambientColor: viewer.getAttribute("ambient-color")
    });

    // 配置网格加载器（支持 STL、OBJ 等格式）
    // 使用 URDF 中指定的颜色，不主动查找 MTL 文件
    if (window.STLLoader && window.OBJLoader) {
        const stlLoader = new window.STLLoader();
        const objLoader = new window.OBJLoader();

        // 辅助函数：从 URDF 材质信息中提取颜色
        const getColorFromMaterial = (material) => {
            if (!material) return 0xcccccc;

            // 如果 material 有 color 属性
            if (material.color) {
                const c = material.color;
                // 处理不同的颜色格式
                if (typeof c === 'string') {
                    // 处理 rgba 字符串格式 "0.1 0.1 0.1 1.0"
                    const rgba = c.trim().split(/\s+/).map(parseFloat);
                    if (rgba.length >= 3) {
                        return new THREE.Color(rgba[0], rgba[1], rgba[2]).getHex();
                    }
                } else if (Array.isArray(c)) {
                    // 处理数组格式 [r, g, b] 或 [r, g, b, a]
                    return new THREE.Color(c[0] || 0.8, c[1] || 0.8, c[2] || 0.8).getHex();
                } else if (typeof c === 'object') {
                    // 处理对象格式 {r, g, b} 或 {0, 1, 2}
                    return new THREE.Color(c.r || c[0] || 0.8, c.g || c[1] || 0.8, c.b || c[2] || 0.8).getHex();
                }
            }

            return 0xcccccc; // 默认颜色
        };

        viewer.loadMeshFunc = (url, manager, onComplete, material) => {
            console.log("[bootstrap] 加载网格文件:", url);
            console.log("[bootstrap] URDF 材质信息:", material);

            // 从 URDF 材质中提取颜色
            const color = getColorFromMaterial(material);

            // 获取文件扩展名
            const extension = url.split('.').pop().toLowerCase();

            return new Promise((resolve, reject) => {
                if (extension === 'stl') {
                    // 加载 STL 文件
                    console.log("[bootstrap] 使用 STLLoader 加载:", url);
                    stlLoader.load(
                        url,
                        (geometry) => {
                            console.log("[bootstrap] STL 文件加载成功:", url);

                            // 创建材质（使用 URDF 中指定的颜色）
                            const meshMaterial = new THREE.MeshStandardMaterial({
                                color: color,
                                metalness: 0.1,
                                roughness: 0.7
                            });
                            // 创建网格
                            const mesh = new THREE.Mesh(geometry, meshMaterial);
                            // 计算法线（STL文件可能没有法线）
                            geometry.computeVertexNormals();

                            // 如果提供了回调函数，调用它
                            if (typeof onComplete === 'function') {
                                onComplete(mesh);
                            }

                            resolve(mesh);
                        },
                        undefined,
                        (error) => {
                            console.error("[bootstrap] STL 文件加载失败:", url, error);
                            reject(error);
                        }
                    );
                } else if (extension === 'obj') {
                    // 加载 OBJ 文件（不使用 MTL，使用 URDF 中指定的颜色）
                    console.log("[bootstrap] 使用 OBJLoader 加载:", url);

                    objLoader.load(
                        url,
                        (object) => {
                            console.log("[bootstrap] OBJ 文件加载成功:", url);

                            // 为 OBJ 对象的所有 mesh 应用 URDF 中指定的颜色
                            object.traverse((child) => {
                                if (child instanceof THREE.Mesh) {
                                    child.material = new THREE.MeshStandardMaterial({
                                        color: color,
                                        metalness: 0.1,
                                        roughness: 0.7
                                    });
                                }
                            });

                            // 如果提供了回调函数，调用它
                            if (typeof onComplete === 'function') {
                                onComplete(object);
                            }

                            resolve(object);
                        },
                        undefined,
                        (error) => {
                            console.error("[bootstrap] OBJ 文件加载失败:", url, error);
                            reject(error);
                        }
                    );
                } else {
                    // 不支持的文件格式
                    const error = new Error(`不支持的网格文件格式: ${extension}`);
                    console.error("[bootstrap]", error.message, url);
                    reject(error);
                }
            });
        };
        console.log("[bootstrap] 网格加载器已配置（支持 STL、OBJ，使用 URDF 颜色）");
    } else {
        console.warn("[bootstrap] 加载器未找到，尝试使用默认加载器");
    }

    const status = $(".status");
    status.textContent = "URDF 模型加载中...";
    console.log("[bootstrap] 状态已更新为: URDF 模型加载中...");

    // 监听 viewer 的事件
    viewer.addEventListener("urdf-processed", (e) => {
        console.log("[bootstrap] urdf-processed 事件触发:", e);
    });

    viewer.addEventListener("urdf-load-error", (e) => {
        console.error("[bootstrap] urdf-load-error 事件触发:", e);
        console.error("[bootstrap] 错误详情:", e.detail);
    });

    // 检查资源加载
    console.log("[bootstrap] 检查 URDF 文件是否存在...");
    const urdfPath = viewer.getAttribute("urdf");
    if (urdfPath) {
        fetch(urdfPath, { method: "HEAD" })
            .then(response => {
                console.log(`[bootstrap] URDF 文件检查结果 (${urdfPath}):`, {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok
                });
            })
            .catch(error => {
                console.error(`[bootstrap] URDF 文件检查失败 (${urdfPath}):`, error);
            });
    }

    try {
        console.log("[bootstrap] 开始等待 robot 加载...");
        const robot = await waitForRobot(viewer);
        console.log("[bootstrap] robot 加载成功:", robot);
        console.log("[bootstrap] robot 名称:", robot.name);
        console.log("[bootstrap] robot joints 数量:", Object.keys(robot.joints || {}).length);

        // 设置全局光照
        console.log("[bootstrap] 开始设置全局光照...");
        if (viewer.scene) {
            // 清除现有的方向光（如果有）
            const existingLights = [];
            viewer.scene.traverse((child) => {
                if (child instanceof THREE.DirectionalLight) {
                    existingLights.push(child);
                }
            });
            existingLights.forEach(light => {
                if (light.parent) {
                    light.parent.remove(light);
                }
            });
            console.log("[bootstrap] 已清除现有的方向光:", existingLights.length);

            // 添加环境光（全局均匀照明）
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
            viewer.scene.add(ambientLight);
            console.log("[bootstrap] 已添加环境光");

            // 添加半球光（模拟天空和地面的反射光）
            const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.1);
            hemisphereLight.position.set(0, 10, 0);
            viewer.scene.add(hemisphereLight);
            console.log("[bootstrap] 已添加半球光");

            console.log("[bootstrap] 已添加全局光照（环境光 + 半球光）");

            // 强制更新场景
            if (viewer.redraw) {
                viewer.redraw();
            }
        } else {
            console.warn("[bootstrap] viewer.scene 不存在，无法设置光照");
        }

        // 调整相机位置，使其更靠近机器人
        console.log("[bootstrap] 开始调整相机位置...");
        if (viewer.camera) {
            // 计算机器人的边界框
            const box = new THREE.Box3();
            robot.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    const childBox = new THREE.Box3().setFromObject(child);
                    box.union(childBox);
                }
            });

            if (!box.isEmpty()) {
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);

                // 设置相机位置，距离机器人更近（使用机器人尺寸的1.5倍作为距离）
                const distance = maxDim * 1.5;
                viewer.camera.position.set(
                    center.x + distance * 0.7,
                    center.y + distance * 0.7,
                    center.z + distance * 0.7
                );

                // 让相机看向机器人中心
                viewer.camera.lookAt(center);

                // 更新相机
                viewer.camera.updateProjectionMatrix();

                console.log("[bootstrap] 相机位置已调整:", {
                    position: viewer.camera.position,
                    target: center,
                    distance: distance
                });
            } else {
                // 如果无法计算边界框，使用默认的近距离位置
                viewer.camera.position.set(2, 2, 2);
                viewer.camera.lookAt(0, 0, 0);
                viewer.camera.updateProjectionMatrix();
                console.log("[bootstrap] 使用默认近距离相机位置");
            }
        } else {
            console.warn("[bootstrap] viewer.camera 不存在，无法调整相机位置");
        }

        status.textContent = `已加载：${robot.name || "URDF Robot"}`;
        console.log("[bootstrap] 开始设置关节UI...");
        setupJointsUI(viewer, robot);
        console.log("[bootstrap] 关节UI设置完成");
    } catch (error) {
        console.error("[bootstrap] 加载过程中出错:", error);
        console.error("[bootstrap] 错误堆栈:", error.stack);
        status.textContent = `错误: ${error.message}`;
    }

    $(".action-reset").addEventListener("click", () => {
        const viewerRobot = viewer.robot;
        if (!viewerRobot) {
            return;
        }

        Object.values(viewerRobot.joints).forEach((joint) => {
            if (joint.jointType === "fixed") {
                return;
            }
            joint.setJointValue(0);
        });

        $$(".joint-card").forEach((card) => {
            const slider = $(".joint-slider", card);
            const valueLabel = $(".joint-value", card);
            slider.value = 0;
            valueLabel.textContent = formatAngle(0);
        });
    });
}

console.log("[模块] 注册 DOMContentLoaded 事件监听器");
window.addEventListener("DOMContentLoaded", () => {
    console.log("[DOMContentLoaded] 事件触发，调用 bootstrap()");
    bootstrap().catch(error => {
        console.error("[DOMContentLoaded] bootstrap 执行失败:", error);
    });
});

// 如果 DOM 已经加载完成，立即执行
if (document.readyState === "loading") {
    console.log("[模块] DOM 正在加载中，等待 DOMContentLoaded 事件");
} else {
    console.log("[模块] DOM 已加载完成，立即执行 bootstrap()");
    bootstrap().catch(error => {
        console.error("[模块] bootstrap 执行失败:", error);
    });
}