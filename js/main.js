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

    // 3. 初始化所有省份容器
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

        showAllProvinceContainers();
    }

    // 4. 填充省份容器内容
    function populateProvinceContainer(container, provinceInfo) {
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

            // 只有学生人数大于2才显示人数标签
            const studentCountHtml = uni.students.length > 4
                ? `<span class="student-count">${uni.students.length}人</span>`
                : '';

            uniItem.innerHTML = `
                <div class="university-card-layout">
                    <img src="${uni.logo}" alt="${uni.name}" 
                         class="university-logo"
                         onerror="this.src='images/logos/default.png'">
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
                containerData.element.classList.add('visible');
            } else {
                // 隐藏其他容器
                containerData.element.style.display = 'none';
                containerData.element.classList.remove('visible');
            }
        });
    }

    // 6. 显示所有省份容器
    function showAllProvinceContainers() {
        // 按顺序显示容器，创建交错动画效果
        allProvinceContainers.forEach((containerData, index) => {
            containerData.element.style.display = 'block';
            containerData.element.style.transform = 'scale(1)';
            containerData.element.style.zIndex = '10';
            containerData.element.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.12)';

            // 添加交错动画延迟
            setTimeout(() => {
                containerData.element.classList.add('visible');
            }, index * 100); // 每个容器延迟100ms显示
        });
    }

    // 7. 绑定非地图区域点击事件
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

    // 8. 绑定地图悬浮事件
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

    // 9. 绑定地图移出事件
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

    // 10. 绑定地图点击事件
    myChart.on('click', function (params) {
        if (params.componentType === 'series' && params.seriesType === 'map') {
            const provinceName = params.name;

            // 如果点击的是当前选中的省份，则取消选择
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
});