document.addEventListener('DOMContentLoaded', function () {
    const myChart = echarts.init(document.getElementById('china-map'));
    let currentSelectedProvince = null;
    let currentHoveredProvince = null;
    let allProvinceContainers = []; // 存储所有省份容器

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

    // 3. 初始化显示所有省份容器
    function initializeAllProvinceContainers() {
        const container = document.getElementById('university-info-container');
        const rightPanelWidth = window.innerWidth * 0.5;
        const rightPanelHeight = window.innerHeight;

        // 清空现有容器
        container.innerHTML = '';
        allProvinceContainers = [];

        // 自适应网格布局参数
        const margin = 15;
        const estimatedContainerWidth = 250; // 估算容器宽度用于布局计算
        const estimatedContainerHeight = 200; // 估算容器高度用于布局计算
        const cols = Math.max(1, Math.floor(rightPanelWidth / (estimatedContainerWidth + margin)));

        graduateData.forEach((provinceInfo, index) => {
            // 计算自适应网格位置
            const row = Math.floor(index / cols);
            const col = index % cols;
            let x = col * (estimatedContainerWidth + margin) + margin;
            let y = row * (estimatedContainerHeight + margin) + margin;

            // 确保不溢出屏幕
            x = Math.min(x, rightPanelWidth - 200); // 至少留200px空间给容器
            y = Math.max(y, margin);

            // 创建省份容器
            const provinceContainer = createProvinceContainer(provinceInfo, x, y);
            provinceContainer.setAttribute('data-province', provinceInfo.province);
            container.appendChild(provinceContainer);

            // 存���容器引用
            allProvinceContainers.push({
                element: provinceContainer,
                province: provinceInfo.province
            });

            // 显示动画
            setTimeout(() => {
                provinceContainer.classList.add('visible');
                // 布局完成后调整位置避免重叠
                adjustContainerPosition(provinceContainer, index);
            }, index * 50);
        });
    }

    // 4. 调整容器位置避免重叠和溢出
    function adjustContainerPosition(container, index) {
        const rect = container.getBoundingClientRect();
        const rightPanelRect = document.getElementById('university-info-container').getBoundingClientRect();

        // 检查是否溢出右边界
        if (rect.right > rightPanelRect.right) {
            const newLeft = rightPanelRect.right - rect.width - 15;
            container.style.left = Math.max(15, newLeft - rightPanelRect.left) + 'px';
        }

        // 检查是否溢出底部边界
        if (rect.bottom > rightPanelRect.bottom) {
            const newTop = rightPanelRect.bottom - rect.height - 15;
            container.style.top = Math.max(15, newTop - rightPanelRect.top) + 'px';
        }
    }

    // 5. 显示特定省份容器（隐藏其他）
    function showSpecificProvinceInfo(provinceName, isClick = false) {
        const provinceInfo = graduateData.find(p => p.province === provinceName);
        // 如果省份没有学校信息，则不显示任何内容
        if (!provinceInfo) return;

        // 如果不是点击事件且已有点击选中的省份，则不处理悬浮
        if (!isClick && currentSelectedProvince && currentSelectedProvince !== provinceName) {
            return;
        }

        // 隐藏所有容器
        allProvinceContainers.forEach(containerData => {
            if (containerData.province === provinceName) {
                // 显示目标容器
                containerData.element.style.display = 'block';
                containerData.element.style.transform = 'scale(1.05)';
                containerData.element.style.zIndex = '20';
                containerData.element.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.25)';
            } else {
                // 隐藏其他容器
                containerData.element.style.display = 'none';
            }
        });

        // 清除现有箭头
        const arrowsContainer = document.getElementById('arrows-container');
        arrowsContainer.innerHTML = '';

        // 创建箭头SVG定义
        createArrowMarker(arrowsContainer);

        // 找到目标容器的位置
        const targetContainer = allProvinceContainers.find(c => c.province === provinceName);
        if (targetContainer) {
            const rect = targetContainer.element.getBoundingClientRect();
            const mapWidth = window.innerWidth * 0.5;

            // 创建箭头
            const startX = mapWidth * 0.85;
            const startY = window.innerHeight * 0.5;
            const endX = rect.left - mapWidth + 20;
            const endY = rect.top + 30;

            const arrow = createArrow(startX, startY, endX, endY);
            arrowsContainer.appendChild(arrow);

            setTimeout(() => {
                arrow.classList.add('visible');
            }, 100);
        }
    }

    // 6. 创建省份容器（自适应尺寸）
    function createProvinceContainer(provinceInfo, x, y) {
        const container = document.createElement('div');
        container.className = 'province-container-item';
        container.style.left = x + 'px';
        container.style.top = y + 'px';
        // 移除固定尺寸设置，让容器自适应内容

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

            uniItem.innerHTML = `
                <div class="university-card-layout">
                    <img src="${uni.logo}" alt="${uni.name}" 
                         class="university-logo"
                         onerror="this.src='images/logos/default.png'">
                    <div class="university-content">
                        <div class="university-header">
                            <h4>${uni.name}</h4>
                            <span class="student-count">${uni.students.length}人</span>
                        </div>
                        <div class="student-names">${uni.students.join('、')}</div>
                    </div>
                </div>
            `;

            universitiesList.appendChild(uniItem);
        });

        container.appendChild(universitiesList);
        return container;
    }

    // 6. 创建箭头标记
    function createArrowMarker(container) {
        if (container.querySelector('#arrow-marker')) return;

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = 'arrow-marker';
        svg.style.position = 'absolute';
        svg.style.width = '0';
        svg.style.height = '0';

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.id = "arrowhead";
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "7");
        marker.setAttribute("refX", "9");
        marker.setAttribute("refY", "3.5");
        marker.setAttribute("orient", "auto");

        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
        polygon.style.fill = "#007bff";

        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);
        container.appendChild(svg);
    }

    // 7. 创建箭头
    function createArrow(startX, startY, endX, endY) {
        const arrow = document.createElement('div');
        arrow.className = 'arrow-line';

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.position = 'absolute';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

        // 创建曲线路径
        const controlX = startX + (endX - startX) * 0.5;
        const controlY = startY - 50;
        const pathData = `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;

        path.setAttribute("d", pathData);
        path.style.stroke = "#007bff";
        path.style.strokeWidth = "2";
        path.style.fill = "none";
        path.setAttribute("marker-end", "url(#arrowhead)");

        svg.appendChild(path);
        arrow.appendChild(svg);

        return arrow;
    }

    // 7. 清除省份信息
    function clearProvinceInfo() {
        const container = document.getElementById('university-info-container');
        const arrowsContainer = document.getElementById('arrows-container');

        container.innerHTML = '';
        arrowsContainer.innerHTML = '';
    }

    // 8. 绑定非地图区域点击事件
    document.addEventListener('click', function(event) {
        // 检查点击是否在地图区域外
        const mapElement = document.getElementById('china-map');
        const mapRect = mapElement.getBoundingClientRect();

        // 如果点击在地图区域外且有选中的省份，则显示所有容器
        if (currentSelectedProvince &&
            (event.clientX < mapRect.left || event.clientX > mapRect.right ||
             event.clientY < mapRect.top || event.clientY > mapRect.bottom)) {

            // 取消地图选中状态
            myChart.dispatchAction({
                type: 'unselect',
                name: currentSelectedProvince
            });
            currentSelectedProvince = null;
            showAllProvinceContainers();
        }
    });

    // 9. 绑定地图悬浮事件
    myChart.on('mouseover', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            const provinceName = params.name;
            if (currentHoveredProvince !== provinceName) {
                currentHoveredProvince = provinceName;
                // 如果当前有选中的省份，悬浮其他省份时隐藏选中的省份
                if (currentSelectedProvince && currentSelectedProvince !== provinceName) {
                    showSpecificProvinceInfo(provinceName, false);
                } else if (!currentSelectedProvince) {
                    showSpecificProvinceInfo(provinceName, false);
                }
            }
        }
    });

    // 10. 绑定地图移出事件
    myChart.on('mouseout', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            currentHoveredProvince = null;
            // 如果有选中省份，恢复显示选中省份；否则显示所有容器
            if (currentSelectedProvince) {
                showSpecificProvinceInfo(currentSelectedProvince, true);
            } else {
                showAllProvinceContainers();
            }
        }
    });

    // 11. 绑定地图点击事件
    myChart.on('click', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            const provinceName = params.name;

            // 如果点击���是当前选中的省份，则取消选择
            if (currentSelectedProvince === provinceName) {
                myChart.dispatchAction({
                    type: 'unselect',
                    name: provinceName
                });
                currentSelectedProvince = null;

                // 如果鼠标还在省份上，显示特定信息，否则显示所有
                if (currentHoveredProvince === provinceName) {
                    showSpecificProvinceInfo(provinceName, false);
                } else {
                    showAllProvinceContainers();
                }
            } else {
                // 选择新省份
                if (currentSelectedProvince) {
                    myChart.dispatchAction({
                        type: 'unselect',
                        name: currentSelectedProvince
                    });
                }

                myChart.dispatchAction({
                    type: 'select',
                    name: provinceName
                });
                currentSelectedProvince = provinceName;
                showSpecificProvinceInfo(provinceName, true);
            }
        }
    });

    // 5. 显示所有省份容器
    function showAllProvinceContainers() {
        allProvinceContainers.forEach(containerData => {
            containerData.element.style.display = 'block';
            containerData.element.style.transform = 'scale(1)';
            containerData.element.style.zIndex = '10';
            containerData.element.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
        });

        // 清除箭头
        const arrowsContainer = document.getElementById('arrows-container');
        arrowsContainer.innerHTML = '';
    }
});