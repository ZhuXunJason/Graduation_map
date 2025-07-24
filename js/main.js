document.addEventListener('DOMContentLoaded', function () {
    const myChart = echarts.init(document.getElementById('china-map'));

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
                roam: true,
                label: {
                    show: false, // 默认不显示省份名称
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
                        show: true, // 悬浮时显示省份名称
                        color: '#333',
                        fontSize: 14,
                        fontWeight: 'bold'
                    }
                },
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
        });

    // 3. 创建箭头和校徽显示函数
    function showUniversityInfo(provinceName, mouseX, mouseY) {
        const provinceInfo = graduateData.find(p => p.province === provinceName);
        if (!provinceInfo) return;

        clearUniversityInfo();

        const container = document.getElementById('university-info-container');
        const arrowsContainer = document.getElementById('arrows-container');

        // 创建箭头SVG定义
        createArrowMarker(arrowsContainer);

        provinceInfo.universities.forEach((uni, index) => {
            // 计算校徽卡片位置
            const cardX = mouseX + 100 + (index % 2) * 220;
            const cardY = mouseY + (Math.floor(index / 2)) * 120;

            // 创建大学信息卡片
            const card = createUniversityCard(uni, cardX, cardY);
            container.appendChild(card);

            // 创建箭头
            const arrow = createArrow(mouseX, mouseY, cardX + 100, cardY + 30);
            arrowsContainer.appendChild(arrow);

            // 延迟显示动画
            setTimeout(() => {
                card.classList.add('visible');
                arrow.classList.add('visible');
            }, index * 100);
        });
    }

    // 4. 创建箭头标记
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

    // 5. 创建大学信息卡片
    function createUniversityCard(uni, x, y) {
        const card = document.createElement('div');
        card.className = 'university-card';
        card.style.left = x + 'px';
        card.style.top = y + 'px';

        const totalStudents = uni.students.length;

        card.innerHTML = `
            <div class="university-header">
                <img src="${uni.logo}" alt="${uni.name} Logo" onerror="this.src='images/logos/default.png'">
                <div>
                    <h4>${uni.name}</h4>
                    <div class="student-count">${totalStudents}人</div>
                </div>
            </div>
            <div class="student-list">${uni.students.join('、')}</div>
        `;

        return card;
    }

    // 6. 创建箭头
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

    // 7. 清除显示的信息
    function clearUniversityInfo() {
        const container = document.getElementById('university-info-container');
        const arrowsContainer = document.getElementById('arrows-container');
        container.innerHTML = '';
        arrowsContainer.innerHTML = '';
    }

    // 8. 绑定地图悬浮事件
    myChart.on('mouseover', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            // 使用鼠标实际位置而不是地理坐标
            const event = params.event;
            if (event && event.offsetX !== undefined && event.offsetY !== undefined) {
                const mouseX = event.offsetX;
                const mouseY = event.offsetY;
                showUniversityInfo(params.name, mouseX, mouseY);
            }
        }
    });

    // 9. 绑定地图移出事件
    myChart.on('mouseout', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            clearUniversityInfo();
        }
    });

    // 10. 处理地图缩放和平移时的坐标更新
    myChart.on('georoam', function (params) {
        clearUniversityInfo();
    });
});