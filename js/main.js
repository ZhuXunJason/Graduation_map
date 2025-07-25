document.addEventListener('DOMContentLoaded', function () {
    // 核心变量
    const myChart = echarts.init(document.getElementById('china-map'));
    let currentSelectedProvince = null;
    let allProvinceContainers = [];
    let dynamicContainers = new Map();
    let isMobile = false;

    // 防抖定时器
    let eventTimers = {
        click: null,
        mouseover: null,
        mouseout: null
    };
    let isClickHandling = false;

    // 工具函数：清除指定的防抖定时器
    function clearTimer(timerName) {
        if (eventTimers[timerName]) {
            clearTimeout(eventTimers[timerName]);
            eventTimers[timerName] = null;
        }
    }

    // 工具函数：设置防抖定时器
    function setTimer(timerName, callback, delay) {
        clearTimer(timerName);
        eventTimers[timerName] = setTimeout(() => {
            callback();
            eventTimers[timerName] = null;
        }, delay);
    }

    // 检测移动端设备
    function checkMobileMode() {
        isMobile = window.innerWidth <= 1000;
    }

    // 初始化桌面端右侧容器显示
    function initDesktopSidebar() {
        if (isMobile) return;

        const sidebarContent = document.getElementById('sidebar-content');
        if (!sidebarContent) return;

        // 按照学生人数计算并排序所有省份
        const sortedProvinces = graduateData
            .map(province => ({
                ...province,
                totalStudents: province.universities.reduce((sum, uni) => sum + uni.students.length, 0)
            }))
            .sort((a, b) => b.totalStudents - a.totalStudents); // 按学生人数倒序排列

        // 清空容器内容
        sidebarContent.innerHTML = '';

        // 为每个省份创建容器并添加到右侧栏
        sortedProvinces.forEach(province => {
            const container = document.createElement('div');
            container.className = 'province-container-item';
            container.id = `sidebar-province-${province.province}`;
            container.dataset.province = province.province;

            // 填充容器内容
            populateProvinceContainer(container, province);

            // 添加到右侧栏
            sidebarContent.appendChild(container);
        });
    }

    // 获取省份在地图上的像素坐标
    function getProvincePixelPosition(provinceName) {
        try {
            const coords = PROVINCE_COORDS[provinceName];
            if (coords) {
                const convertedCoord = myChart.convertToPixel('series', coords);
                if (convertedCoord && convertedCoord[0] && convertedCoord[1]) {
                    return { x: convertedCoord[0], y: convertedCoord[1] };
                }
            }
            return null;
        } catch (error) {
            console.warn('获取省份坐标失败:', error);
            return null;
        }
    }

    // 省份地理坐标映射表
    const PROVINCE_COORDS = {
        '北京': [116.4, 39.9], '天津': [117.2, 39.1], '河北': [114.5, 38.0],
        '山西': [112.5, 37.9], '内蒙古': [111.8, 40.8], '辽宁': [123.4, 41.8],
        '吉林': [125.3, 43.9], '黑龙江': [126.6, 45.8], '上海': [121.5, 31.2],
        '江苏': [118.8, 32.0], '浙江': [120.2, 30.3], '安徽': [117.3, 31.9],
        '福建': [119.3, 26.1], '江西': [115.9, 28.7], '山东': [117.0, 36.7],
        '河南': [113.6, 34.8], '湖北': [114.3, 30.6], '湖南': [113.0, 28.2],
        '广东': [113.3, 23.1], '广西': [108.3, 22.8], '海南': [110.3, 20.0],
        '重庆': [106.5, 29.6], '四川': [104.1, 30.7], '贵州': [106.7, 26.6],
        '云南': [102.7, 25.0], '西藏': [91.1, 29.6], '陕西': [108.9, 34.3],
        '甘肃': [103.8, 36.1], '青海': [101.8, 36.6], '宁夏': [106.3, 38.5],
        '新疆': [87.6, 43.8], '台湾': [121.0, 24.0], '香港': [114.2, 22.3],
        '澳门': [113.5, 22.2]
    };

    // 计算容器实际尺寸
    function getContainerSize(container) {
        // 临时显示容器以获取实际尺寸
        const wasVisible = container.classList.contains('visible');
        if (!wasVisible) {
            container.style.visibility = 'hidden';
            container.style.opacity = '1';
            container.classList.add('visible');
        }

        const rect = container.getBoundingClientRect();
        const size = {
            width: Math.max(220, Math.min(300, rect.width || 280)),
            height: Math.max(150, Math.min(400, rect.height || 200))
        };

        // 恢复原始状态
        if (!wasVisible) {
            container.classList.remove('visible');
            container.style.visibility = '';
            container.style.opacity = '';
        }

        return size;
    }

    // 计算容器最佳显示位置
    function calculateContainerPosition(provincePixelPos, container) {
        if (!provincePixelPos) return { left: '50px', top: '50px' };

        const containerSize = container ? getContainerSize(container) : { width: 280, height: 200 };
        const margin = 20;
        const screen = { width: window.innerWidth, height: window.innerHeight };
        const availableWidth = isMobile ? screen.width : screen.width - 300; // 桌面端考虑右侧栏

        // 定义可能的显示位置（按优先级排序）
        const positions = [
            // 右侧
            {
                left: provincePixelPos.x + margin,
                top: provincePixelPos.y - containerSize.height / 2,
                priority: 1
            },
            // 左侧
            {
                left: provincePixelPos.x - containerSize.width - margin,
                top: provincePixelPos.y - containerSize.height / 2,
                priority: 2
            },
            // 上方
            {
                left: provincePixelPos.x - containerSize.width / 2,
                top: provincePixelPos.y - containerSize.height - margin,
                priority: 3
            },
            // 下方
            {
                left: provincePixelPos.x - containerSize.width / 2,
                top: provincePixelPos.y + margin,
                priority: 4
            },
            // 右上角
            {
                left: provincePixelPos.x + margin,
                top: provincePixelPos.y - containerSize.height - margin,
                priority: 5
            },
            // 右下角
            {
                left: provincePixelPos.x + margin,
                top: provincePixelPos.y + margin,
                priority: 6
            },
            // 左上角
            {
                left: provincePixelPos.x - containerSize.width - margin,
                top: provincePixelPos.y - containerSize.height - margin,
                priority: 7
            },
            // 左下角
            {
                left: provincePixelPos.x - containerSize.width - margin,
                top: provincePixelPos.y + margin,
                priority: 8
            }
        ];

        // 检查位置是否在屏幕范围内
        function isPositionValid(pos) {
            return pos.left >= margin &&
                pos.top >= margin &&
                pos.left + containerSize.width <= availableWidth - margin &&
                pos.top + containerSize.height <= screen.height - margin;
        }

        // 寻找第一个有效位置
        for (const pos of positions) {
            if (isPositionValid(pos)) {
                return { left: `${pos.left}px`, top: `${pos.top}px` };
            }
        }

        // 如果所有预设位置都无效，则使用强制调整的位置
        let fallbackLeft = Math.max(margin, Math.min(
            provincePixelPos.x + margin,
            availableWidth - containerSize.width - margin
        ));

        let fallbackTop = Math.max(margin, Math.min(
            provincePixelPos.y - containerSize.height / 2,
            screen.height - containerSize.height - margin
        ));

        return { left: `${fallbackLeft}px`, top: `${fallbackTop}px` };
    }

    // 创建动态容器
    function createDynamicContainer(provinceName, provinceInfo) {
        const container = document.createElement('div');
        container.className = 'dynamic-province-container';
        container.id = `dynamic-${provinceName}`;

        // 填充容器内容
        populateProvinceContainer(container, provinceInfo);

        // 添加到动态容器区域
        document.getElementById('dynamic-containers').appendChild(container);

        return container;
    }

    // 显示动态容器
    function showDynamicContainer(provinceName) {
        const provinceInfo = graduateData.find(p => p.province === provinceName);
        if (!provinceInfo) return;

        hideDynamicContainers();

        // 获取或创建动态容器
        let container = dynamicContainers.get(provinceName);
        let isNewContainer = false;

        if (!container) {
            container = createDynamicContainer(provinceName, provinceInfo);
            dynamicContainers.set(provinceName, container);
            isNewContainer = true;
        }

        // 只有新创建的容器才需要计算位置
        if (isNewContainer) {
            const provincePixelPos = getProvincePixelPosition(provinceName);
            const position = calculateContainerPosition(provincePixelPos, container);
            Object.assign(container.style, position);
        }

        container.classList.add('visible');
    }

    // 隐藏所有动态容器
    function hideDynamicContainers() {
        dynamicContainers.forEach(container => {
            container.classList.remove('visible');
        });
    }

    // 数据预处理和地图初始化
    checkMobileMode();

    const provinceData = graduateData.map(province => ({
        name: province.province,
        value: province.universities.reduce((sum, uni) => sum + uni.students.length, 0)
    }));

    // 根据人数分级确定颜色
    function getColorByStudentCount(count) {
        if (!count) return '#e0e0e0';
        if (count <= 2) return '#cce7ff';
        if (count <= 5) return '#66b3ff';
        if (count <= 10) return '#0080ff';
        return '#0066cc';
    }

    // ECharts配置
    const option = {
        tooltip: { show: false },
        series: [{
            name: '毕业生分布',
            type: 'map',
            map: 'china',
            roam: false,
            label: { show: false, color: '#333', fontSize: 12 },
            itemStyle: { borderColor: '#fff', borderWidth: 1 },
            emphasis: {
                itemStyle: { borderWidth: 2, borderColor: '#333' },
                label: { show: true, color: '#333', fontSize: 14, fontWeight: 'bold' }
            },
            select: {
                itemStyle: {
                    borderWidth: 3,
                    borderColor: '#007bff',
                    areaColor: '#cce7ff'
                }
            },
            selectedMode: 'single',
            data: provinceData.map(item => ({
                name: item.name,
                value: item.value,
                itemStyle: { areaColor: getColorByStudentCount(item.value) }
            }))
        }]
    };

    // 初始化地图和容器
    fetch('json/china.json')
        .then(response => response.json())
        .then(chinaJson => {
            echarts.registerMap('china', chinaJson);
            myChart.setOption(option);

            setTimeout(() => {
                myChart.setOption({
                    series: [{ roam: false, center: [104.0, 37.5], zoom: 1.2 }]
                });
                initializeAllProvinceContainers();
                initDesktopSidebar();
            }, 100);
        });

    // 初始化所有省份容器
    function initializeAllProvinceContainers() {
        allProvinceContainers = [];
        const allContainers = document.querySelectorAll('.province-container-item[data-province]');

        allContainers.forEach(container => {
            const provinceName = container.getAttribute('data-province');
            const provinceInfo = graduateData.find(p => p.province === provinceName);

            if (provinceInfo) {
                populateProvinceContainer(container, provinceInfo);
                allProvinceContainers.push({ element: container, province: provinceName });
            }
        });

        // 根据设备类型决定显示状态
        isMobile ? hideFirstSetContainers() : showFirstSetContainers();
    }

    // 填充省份容器内容
    function populateProvinceContainer(container, provinceInfo) {
        const totalStudents = provinceInfo.universities.reduce((sum, uni) => sum + uni.students.length, 0);

        container.innerHTML = `
            <h2>${provinceInfo.province} (${totalStudents}人)</h2>
            <div class="universities-list">
                ${provinceInfo.universities.map(uni => `
                    <div class="university-item">
                        <div class="university-card-layout">
                            <img src="${uni.logo}" alt="${uni.name}" class="university-logo">
                            <div class="university-content">
                                <div class="university-header">
                                    <h4>${uni.name}</h4>
                                    ${uni.students.length > 3 ? `<span class="student-count">${uni.students.length}人</span>` : ''}
                                </div>
                                <div class="student-names">${uni.students.join('、')}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 显示/隐藏第一套容器
    function showFirstSetContainers() {
        if (isMobile) return;
        allProvinceContainers.forEach(containerData => {
            containerData.element.style.display = 'block';
            containerData.element.classList.add('visible');
        });
    }

    function hideFirstSetContainers() {
        allProvinceContainers.forEach(containerData => {
            containerData.element.style.display = 'none';
            containerData.element.classList.remove('visible');
        });
    }

    // 鼠标事件处理
    myChart.on('mouseover', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            clearTimer('mouseout');
            setTimer('mouseover', () => {
                currentHoveredProvince = params.name;
                hideFirstSetContainers();
                if (!currentSelectedProvince) {
                    hideDynamicContainers();
                    showDynamicContainer(params.name);
                }
            }, 50);
        }
    });

    myChart.on('mouseout', function (params) {
        if (isClickHandling || params.componentType !== 'series' || params.seriesType !== 'map') return;

        setTimer('mouseout', () => {
            if (eventTimers.mouseover) return; // 有新的悬浮事件，跳过

            currentHoveredProvince = null;
            if (currentSelectedProvince === params.name) return; // 保持选中状态

            if (isMobile) {
                if (!currentSelectedProvince) hideDynamicContainers();
            } else {
                if (!currentSelectedProvince) {
                    hideDynamicContainers();
                    showFirstSetContainers();
                }
            }
        }, 150);
    });

    // 点击事件处理
    myChart.on('click', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            isClickHandling = true;
            setTimer('click', () => {
                handleProvinceClick(params.name);
                isClickHandling = false;
            }, isMobile ? 150 : 50);
        }
    });

    // 处理省份点击逻辑
    function handleProvinceClick(provinceName) {
        if (currentSelectedProvince === provinceName) {
            // 取消选中
            currentSelectedProvince = null;
            myChart.dispatchAction({ type: 'unselect', name: provinceName });
            hideDynamicContainers();
            if (!isMobile) showFirstSetContainers();
        } else {
            // 选中新省份
            if (currentSelectedProvince) {
                myChart.dispatchAction({ type: 'unselect', name: currentSelectedProvince });
            }
            currentSelectedProvince = provinceName;
            myChart.dispatchAction({ type: 'select', name: provinceName });
            hideFirstSetContainers();
            hideDynamicContainers();
            showDynamicContainer(provinceName);
        }
    }

    // 全局点击事件处理
    function handleOutsideClick(event) {
        const chartContainer = document.getElementById('china-map');
        const dynamicContainersDiv = document.getElementById('dynamic-containers');

        const isInsideChart = chartContainer?.contains(event.target);
        const isInsideDynamicContainer = dynamicContainersDiv?.contains(event.target);

        if (!isInsideChart && !isInsideDynamicContainer && currentSelectedProvince) {
            myChart.dispatchAction({ type: 'unselect', name: currentSelectedProvince });
            currentSelectedProvince = null;
            hideDynamicContainers();
            if (!isMobile) showFirstSetContainers();
        }
    }

    // 桌面端和移动端事件监听
    document.addEventListener('click', handleOutsideClick);

    let touchStartTime = 0;
    let touchMoved = false;

    document.addEventListener('touchstart', () => {
        touchStartTime = Date.now();
        touchMoved = false;
    }, { passive: true });

    document.addEventListener('touchmove', () => {
        touchMoved = true;
    }, { passive: true });

    document.addEventListener('touchend', (event) => {
        const touchDuration = Date.now() - touchStartTime;
        if (!touchMoved && touchDuration < 500) {
            setTimeout(() => handleOutsideClick(event), 100);
        }
    }, { passive: true });
});