document.addEventListener('DOMContentLoaded', function () {
    const myChart = echarts.init(document.getElementById('china-map'));
    let currentSelectedProvince = null;
    let currentHoveredProvince = null;
    let allProvinceContainers = []; // 第一套容器：桌面端固定位置
    let dynamicContainers = new Map(); // 第二套容器：动态位置
    let isMobile = false; // 判断是否为移动端
    let isClickHandling = false; // 防止事件冲突的标记
    let clickTimeout = null; // 点击防抖定时器
    let mouseoverTimeout = null; // 鼠标悬浮防抖定时器
    let mouseoutTimeout = null; // 鼠标离开防抖定时器

    // 检测是否为移动端
    function checkMobileMode() {
        isMobile = window.innerWidth <= 1000;
    }

    // 获取省份在地图上的像素坐标
    function getProvincePixelPosition(provinceName) {
        try {
            const provinceCoords = getProvinceApproximateCoords(provinceName);
            if (provinceCoords) {
                const convertedCoord = myChart.convertToPixel('series', provinceCoords);
                if (convertedCoord && convertedCoord[0] && convertedCoord[1]) {
                    return {
                        x: convertedCoord[0],
                        y: convertedCoord[1]
                    };
                }
            }
            return null;
        } catch (error) {
            console.warn('获取省份坐标失败:', error);
            return null;
        }
    }

    // 省份大致地理坐标（经纬度）
    function getProvinceApproximateCoords(provinceName) {
        const coords = {
            '北京': [116.4, 39.9],
            '天津': [117.2, 39.1],
            '河北': [114.5, 38.0],
            '山西': [112.5, 37.9],
            '内蒙古': [111.8, 40.8],
            '辽宁': [123.4, 41.8],
            '吉林': [125.3, 43.9],
            '黑龙江': [126.6, 45.8],
            '上海': [121.5, 31.2],
            '江苏': [118.8, 32.0],
            '浙江': [120.2, 30.3],
            '安徽': [117.3, 31.9],
            '福建': [119.3, 26.1],
            '江西': [115.9, 28.7],
            '山东': [117.0, 36.7],
            '河南': [113.6, 34.8],
            '湖北': [114.3, 30.6],
            '湖南': [113.0, 28.2],
            '广东': [113.3, 23.1],
            '广西': [108.3, 22.8],
            '海南': [110.3, 20.0],
            '重庆': [106.5, 29.6],
            '四川': [104.1, 30.7],
            '贵州': [106.7, 26.6],
            '云南': [102.7, 25.0],
            '西藏': [91.1, 29.6],
            '陕西': [108.9, 34.3],
            '甘肃': [103.8, 36.1],
            '青海': [101.8, 36.6],
            '宁夏': [106.3, 38.5],
            '新疆': [87.6, 43.8],
            '台湾': [121.0, 24.0],
            '香港': [114.2, 22.3],
            '澳门': [113.5, 22.2]
        };
        return coords[provinceName] || null;
    }

    // 计算容器最佳显示位置
    function calculateContainerPosition(provincePixelPos, containerElement) {
        if (!provincePixelPos) return { left: '50px', top: '50px' };

        const containerWidth = 280;
        const containerHeight = 200;
        const margin = 20;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        let left = provincePixelPos.x + margin;
        let top = provincePixelPos.y - containerHeight / 2;

        // 防止容器超出边界
        if (left + containerWidth > screenWidth - margin) {
            left = provincePixelPos.x - containerWidth - margin;
        }

        if (left < margin) {
            left = margin;
        }

        if (top < margin) {
            top = margin;
        }

        if (top + containerHeight > screenHeight - margin) {
            top = screenHeight - containerHeight - margin;
        }

        return {
            left: `${left}px`,
            top: `${top}px`
        };
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

    // 在省份旁边显示动态容器
    function showDynamicContainer(provinceName) {
        const provinceInfo = graduateData.find(p => p.province === provinceName);
        if (!provinceInfo) return;

        // 隐藏所有动态容器
        hideDynamicContainers();

        // 获取或创建动态容器
        let container = dynamicContainers.get(provinceName);
        if (!container) {
            container = createDynamicContainer(provinceName, provinceInfo);
            dynamicContainers.set(provinceName, container);
        }

        // 计算并设置位置
        const provincePixelPos = getProvincePixelPosition(provinceName);
        const position = calculateContainerPosition(provincePixelPos, container);

        container.style.left = position.left;
        container.style.top = position.top;
        container.classList.add('visible');
    }

    // 隐藏所有动态容器
    function hideDynamicContainers() {
        dynamicContainers.forEach(container => {
            container.classList.remove('visible');
        });
    }

    // 初始检测
    checkMobileMode();

    // 1. 数据预处理：计算每个省份的总人数
    const provinceData = graduateData.map(province => {
        let totalStudents = 0;
        province.universities.forEach(uni => {
            totalStudents += uni.students.length;
        });
        return {
            name: province.province,
            value: totalStudents
        };
    });

    // 创建一个省份名称到学生数量的映射
    const provinceStudentMap = {};
    provinceData.forEach(item => {
        provinceStudentMap[item.name] = item.value;
    });

    // 根据人数分级确定颜色
    function getColorByStudentCount(count) {
        if (count === 0 || !count) return '#e0e0e0'; // 灰色 - 无学生
        if (count <= 2) return '#cce7ff';  // 浅蓝色 - 1-2人
        if (count <= 5) return '#66b3ff';  // 中浅蓝色 - 3-5人
        if (count <= 10) return '#0080ff'; // 中蓝色 - 6-10人
        return '#0066cc';                  // 深蓝色 - 10人以上
    }

    // 2. ECharts 配置项
    const option = {
        tooltip: {
            show: false
        },
        series: [
            {
                name: '毕业生分布',
                type: 'map',
                map: 'china',
                roam: false,
                label: {
                    show: false,
                    color: '#333',
                    fontSize: 12
                },
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 1
                },
                emphasis: {
                    itemStyle: {
                        borderWidth: 2,
                        borderColor: '#333'
                    },
                    label: {
                        show: true,
                        color: '#333',
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                },
                select: {
                    itemStyle: {
                        borderWidth: 3,
                        borderColor: '#007bff',
                        areaColor: '#cce7ff'
                    }
                },
                selectedMode: 'single', // 单选模式
                data: provinceData.map(item => ({
                    name: item.name,
                    value: item.value,
                    itemStyle: {
                        areaColor: getColorByStudentCount(item.value)
                    }
                }))
            }
        ]
    };

    // 异步加载中国地图的 GeoJSON 数据
    fetch('json/china.json')
        .then(response => response.json())
        .then(chinaJson => {
            echarts.registerMap('china', chinaJson);
            myChart.setOption(option);

            // 页面加载完毕后固定地图位置
            setTimeout(() => {
                myChart.setOption({
                    series: [{
                        roam: false,
                        center: [104.0, 37.5],
                        zoom: 1.2
                    }]
                });

                // 初始化显示所有省份容器
                initializeAllProvinceContainers();
            }, 100);
        });

    // 3. 初始化所有省份容器（第一套）
    function initializeAllProvinceContainers() {
        allProvinceContainers = [];

        // 查找所有预定义的省份容器
        const allContainers = document.querySelectorAll('.province-container-item[data-province]');

        allContainers.forEach(container => {
            const provinceName = container.getAttribute('data-province');
            const provinceInfo = graduateData.find(p => p.province === provinceName);

            if (provinceInfo) {
                // 填充容器内容
                populateProvinceContainer(container, provinceInfo);

                // 存储容器引用
                allProvinceContainers.push({
                    element: container,
                    province: provinceName
                });
            }
        });

        // 根据设备类型决定初始显示状态
        if (isMobile) {
            hideFirstSetContainers();
        } else {
            showFirstSetContainers();
        }
    }

    // 4. 填充省份容器
    function populateProvinceContainer(container, provinceInfo) {
        // 清空容器内容
        container.innerHTML = '';

        // 计算总学生数
        const totalStudents = provinceInfo.universities.reduce((sum, uni) => sum + uni.students.length, 0);

        // 创建省份标题
        const title = document.createElement('h2');
        title.textContent = `${provinceInfo.province} (${totalStudents}人)`;
        container.appendChild(title);

        // 创建大学列表容器
        const universitiesList = document.createElement('div');
        universitiesList.className = 'universities-list';

        // 为每个大学创建项目
        provinceInfo.universities.forEach(uni => {
            const uniItem = document.createElement('div');
            uniItem.className = 'university-item';

            // 只有学生人数大于4才显示人数标签
            const studentCountHtml = uni.students.length > 4
                ? `<span class="student-count">${uni.students.length}人</span>`
                : '';

            uniItem.innerHTML = `
                <div class="university-card-layout">
                    <img src="${uni.logo}" alt="${uni.name}" 
                         class="university-logo">
                    <div class="university-content">
                        <div class="university-header">
                            <h4>${uni.name}</h4>
                            ${studentCountHtml}
                        </div>
                        <div class="student-names">${uni.students.join('、')}</div>
                    </div>
                </div>
            `;

            universitiesList.appendChild(uniItem);
        });

        container.appendChild(universitiesList);
    }

    // 显示第一套容器
    function showFirstSetContainers() {
        if (isMobile) return; // 移动端不显示第一套容器

        allProvinceContainers.forEach(containerData => {
            containerData.element.style.display = 'block';
            containerData.element.classList.add('visible');
        });
    }

    // 隐藏第一套容器
    function hideFirstSetContainers() {
        allProvinceContainers.forEach(containerData => {
            containerData.element.style.display = 'none';
            containerData.element.classList.remove('visible');
        });
    }

    // 8. 鼠标悬浮事件（带防抖）
    myChart.on('mouseover', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            const provinceName = params.name;

            // 清除所有相关的防抖定时器，让悬浮事件优先执行
            if (mouseoutTimeout) {
                clearTimeout(mouseoutTimeout);
                mouseoutTimeout = null;
            }
            if (mouseoverTimeout) {
                clearTimeout(mouseoverTimeout);
            }

            // 使用较短的延迟，让悬浮响应更快
            mouseoverTimeout = setTimeout(() => {
                currentHoveredProvince = provinceName;
                hideFirstSetContainers();
                if(!currentSelectedProvince){
                    hideDynamicContainers();
                    showDynamicContainer(provinceName);
                }
                mouseoverTimeout = null;
            }, 50);
        }
    });

    // 9. 鼠标离开事件（带防抖）
    myChart.on('mouseout', function (params) {
        if (isClickHandling) return; // 如果正在处理点击事件，忽略mouseout

        if (params.componentType === 'series' && params.seriesType === 'map') {
            const provinceName = params.name;

            // 清除之前的mouseout定时器
            if (mouseoutTimeout) {
                clearTimeout(mouseoutTimeout);
            }

            // 使用较长的延迟，给悬浮事件更多时间执行
            mouseoutTimeout = setTimeout(() => {
                // 检查是否有新的悬浮事件正在处理
                if (mouseoverTimeout) {
                    return; // 有新的悬浮事件，跳过这次离开处理
                }

                currentHoveredProvince = null;

                // 如果当前离开的省份就是被选中的省份，则不隐藏信息
                if (currentSelectedProvince === provinceName) {
                    return; // 保持选中省份信息显示
                }

                if (isMobile) {
                    // 移动端：如果没有选中状态则隐藏动态容器
                    if (!currentSelectedProvince) {
                        hideDynamicContainers();
                    }
                } else {
                    // 桌面端：如果没有选中状态，显示所有第一套容器
                    if (!currentSelectedProvince) {
                        console.log('no currentSelectedProvince, showing first set containers');
                        hideDynamicContainers();
                        showFirstSetContainers();
                    }
                }
                mouseoutTimeout = null;
            }, 150); // 比悬浮事件延迟更长
        }
    });

    // 10. 点击事件
    myChart.on('click', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            isClickHandling = true; // 标记开始处理点击事件

            const provinceName = params.name;

            // 清除之前的防抖定时器
            if (clickTimeout) {
                clearTimeout(clickTimeout);
            }

            // 使用防抖处理点击事件
            clickTimeout = setTimeout(() => {
                handleProvinceClick(provinceName);
                isClickHandling = false; // 标记点击事件处理完成
            }, isMobile ? 150 : 50); // 移动端延迟更长，避免与触摸事件冲突
        }
    });

    // 处理省份点击的核心逻辑
    function handleProvinceClick(provinceName) {
        if (currentSelectedProvince === provinceName) {
            // 取消选中
            currentSelectedProvince = null;
            myChart.dispatchAction({
                type: 'unselect',
                name: provinceName
            });

            hideDynamicContainers();
            if (!isMobile) {
                showFirstSetContainers();
            }
        } else {
            // 选中新省份
            // 先取消之前的选中状态
            if (currentSelectedProvince) {
                myChart.dispatchAction({
                    type: 'unselect',
                    name: currentSelectedProvince
                });
            }

            // 设置新的选中状态
            currentSelectedProvince = provinceName;
            myChart.dispatchAction({
                type: 'select',
                name: provinceName
            });
            hideDynamicContainers();

            // 显示选中省份的动态容器
            hideFirstSetContainers();
            showDynamicContainer(provinceName);
        }
    }

    // 11. 全局点击/触摸事件 - 处理点击图表外区域取消选中
    function handleOutsideClick(event) {
        // 检查点击的元素是否在图表容器内或动态容器内
        const chartContainer = document.getElementById('china-map');
        const dynamicContainersDiv = document.getElementById('dynamic-containers');

        const isInsideChart = chartContainer && chartContainer.contains(event.target);
        const isInsideDynamicContainer = dynamicContainersDiv && dynamicContainersDiv.contains(event.target);

        if (!isInsideChart && !isInsideDynamicContainer) {
            // 点击了图表外的区域，取消选中
            if (currentSelectedProvince) {
                myChart.dispatchAction({
                    type: 'unselect',
                    name: currentSelectedProvince
                });
                currentSelectedProvince = null;

                hideDynamicContainers();
                if (!isMobile) {
                    showFirstSetContainers();
                }
            }
        }
    }

    // 桌面端点击事件
    document.addEventListener('click', handleOutsideClick);

    // 移动端触摸事件支持
    let touchStartTime = 0;
    let touchEndTime = 0;
    let touchMoved = false;

    // 添加触摸事件监听
    document.addEventListener('touchstart', function(event) {
        touchStartTime = Date.now();
        touchMoved = false;
    }, { passive: true });

    document.addEventListener('touchmove', function(event) {
        touchMoved = true;
    }, { passive: true });

    document.addEventListener('touchend', function(event) {
        touchEndTime = Date.now();

        // 只有在没有滑动且触摸时间较短的情况下才认为是点击
        const touchDuration = touchEndTime - touchStartTime;
        if (!touchMoved && touchDuration < 500) {
            // 模拟点击事件处理
            setTimeout(() => {
                handleOutsideClick(event);
            }, 100); // 延迟处理，避免与其他事件冲突
        }
    }, { passive: true });
});