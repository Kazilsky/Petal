#!/bin/bash

# Перейти в нужную директорию
cd /root/Petal/src

# Загрузить переменные из .env в текущий сеанс Bash
export $(grep -v '^#' .env | xargs)

# Запустить основную команду с уже загруженными переменными
/usr/bin/npx tsx main.ts

