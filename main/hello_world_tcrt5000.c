/*
 * ESP32-S3 TCRT5000 红外反射式传感器计数程序
 * 使用TCRT5000传感器检测物体通过并进行计数
 */

#include <stdio.h>
#include <inttypes.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"

static const char *TAG = "tcrt5000_counter";

// TCRT5000传感器配置
#define TCRT5000_PIN GPIO_NUM_1          // TCRT5000输出引脚连接到GPIO1
#define DEBOUNCE_TIME_MS 50              // 防抖时间（毫秒）
#define SENSOR_THRESHOLD_LOW 0           // 检测到物体时的电平（低电平）
#define SENSOR_THRESHOLD_HIGH 1          // 未检测到物体时的电平（高电平）


// 计数相关变量
static volatile uint32_t object_count = 0;
static volatile uint64_t last_detection_time = 0;
static volatile bool sensor_state = false;
static volatile bool last_sensor_state = false;

// 队列用于GPIO中断
static QueueHandle_t gpio_evt_queue = NULL;


/**
 * @brief GPIO中断服务程序
 */
static void IRAM_ATTR gpio_isr_handler(void* arg)
{
    uint32_t gpio_num = (uint32_t) arg;
    xQueueSendFromISR(gpio_evt_queue, &gpio_num, NULL);
}

/**
 * @brief 初始化TCRT5000传感器GPIO
 */
static void tcrt5000_init(void)
{
    // 配置GPIO
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_ANYEDGE,  // 双边沿触发
        .mode = GPIO_MODE_INPUT,
        .pin_bit_mask = (1ULL << TCRT5000_PIN),
        .pull_down_en = 0,
        .pull_up_en = 1,                 // 启用上拉电阻
    };
    gpio_config(&io_conf);

    // 创建GPIO事件队列
    gpio_evt_queue = xQueueCreate(10, sizeof(uint32_t));

    // 安装GPIO中断服务
    gpio_install_isr_service(0);
    gpio_isr_handler_add(TCRT5000_PIN, gpio_isr_handler, (void*) TCRT5000_PIN);

    ESP_LOGI(TAG, "TCRT5000 sensor initialized on GPIO%d", TCRT5000_PIN);
}

/**
 * @brief 处理传感器状态变化
 */
static void process_sensor_change(void)
{
    int level = gpio_get_level(TCRT5000_PIN);
    uint64_t current_time = esp_timer_get_time() / 1000; // 转换为毫秒
    
    // 更新传感器状态
    sensor_state = (level == SENSOR_THRESHOLD_LOW);
    
    // 检测物体通过（从高到低再到高）
    if (sensor_state != last_sensor_state) {
        if (sensor_state == true) { // 检测到物体（低电平）
            uint64_t time_diff = current_time - last_detection_time;
            
            // 防抖处理：如果距离上次检测时间太短，忽略此次检测
            if (time_diff > DEBOUNCE_TIME_MS) {
                object_count++;
                last_detection_time = current_time;
                
                ESP_LOGI(TAG, "Count: %lu, Time: %llu ms", 
                        object_count, current_time);
                
            }
        }
        
        last_sensor_state = sensor_state;
    }
}

/**
 * @brief GPIO事件处理任务
 */
static void gpio_task(void* arg)
{
    uint32_t io_num;
    
    while (1) {
        if (xQueueReceive(gpio_evt_queue, &io_num, portMAX_DELAY)) {
            process_sensor_change();
        }
    }
}







void app_main(void)
{
    ESP_LOGI(TAG, "TCRT5000 Counter Starting...");
    ESP_LOGI(TAG, "ESP-IDF version: %s", esp_get_idf_version());
    
    // 初始化TCRT5000传感器
    tcrt5000_init();
    
    // 读取初始传感器状态
    last_sensor_state = gpio_get_level(TCRT5000_PIN) == SENSOR_THRESHOLD_LOW;
    sensor_state = last_sensor_state;
    
    ESP_LOGI(TAG, "Initial sensor state: %s", 
            last_sensor_state ? "Object detected" : "No object");
    
    // 创建任务
    xTaskCreate(gpio_task, "gpio_task", 4096, NULL, 10, NULL);
    
    ESP_LOGI(TAG, "TCRT5000 Counter Ready!");
    
    // 主循环保持程序运行
    while (1) {
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}
