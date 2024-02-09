import json
from typing import Optional
import logging
from dataclasses import dataclass, field
import tqdm
import torch
import torch.optim
from torch.utils.data import Dataset
import transformers
from transformers import TrainingArguments, Trainer
from transformers import HfArgumentParser
from pynvml import *


def print_gpu_utilization():
    nvmlInit()
    handle = nvmlDeviceGetHandleByIndex(0)
    info = nvmlDeviceGetMemoryInfo(handle)
    logger.info(f"GPU memory occupied: {info.used // 1024 ** 2} MB.")


def load_samples(dataset_path, tokenizer):
    samples = []
    with open(dataset_path, 'r') as f:
        for sample in tqdm.tqdm(json.load(f)):
            try:
                seed = '<SC6>' + sample['input'] + '<extra_id_0>'
                reply = '<extra_id_0>' + sample['output']
                input_tokens = tokenizer.encode(seed, add_special_tokens=False, truncation=True, max_length=1024)
                output_tokens = tokenizer.encode(reply, add_special_tokens=False)
                if len(input_tokens) < 768 and len(output_tokens) < 768:
                    samples.append({'input_tokens': input_tokens, 'output_tokens': output_tokens})
            except Exception as ex:
                print(ex)

    return samples


class SFTDataset(Dataset):
    def __init__(self, samples, tokenizer):
        self.tokenizer = tokenizer
        self.max_input_len = 0
        self.max_output_len = 0
        self.samples = []

        self.bos_token_id = tokenizer.encode('<s>', add_special_tokens=False)[0]
        self.eos_token_id = tokenizer.encode('</s>', add_special_tokens=False)[0]
        self.pad_token_id = tokenizer.encode('<pad>', add_special_tokens=False)[0]

        for sample in samples:
            input_ids = sample['input_tokens']
            output_ids = sample['output_tokens'] + [self.eos_token_id]
            self.samples.append((input_ids, output_ids))
            self.max_input_len = max(self.max_input_len, len(input_ids))
            self.max_output_len = max(self.max_output_len, len(output_ids))

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index: int):
        input_ids, output_ids = self.samples[index]

        input_npad = self.max_input_len - len(input_ids)
        attention_mask = [1] * len(input_ids) + [0] * input_npad
        input_ids = input_ids + input_npad * [self.pad_token_id]

        output_npad = self.max_output_len - len(output_ids)
        labels = output_ids + output_npad * [-100]

        return {'input_ids': torch.LongTensor(input_ids), 'attention_mask': attention_mask,
                'labels': torch.LongTensor(labels)}


@dataclass
class ModelArguments:
    model_name_or_path: Optional[str] = field(metadata={"help": "The model checkpoint for weights initialization."})


@dataclass
class DataTrainingArguments:
    dataset_path: Optional[str] = field(metadata={"help": "Путь к датасету с диалогами"})


if __name__ == '__main__':
    parser = HfArgumentParser((ModelArguments, DataTrainingArguments, TrainingArguments))

    model_args, data_args, training_args = parser.parse_args_into_dataclasses()

    verbose = training_args.local_rank in (-1, 0)

    # Setup logging
    logging.basicConfig(
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        datefmt="%m/%d/%Y %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )

    log_level = training_args.get_process_log_level()
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.INFO)
    transformers.utils.logging.set_verbosity(log_level)
    transformers.utils.logging.enable_default_handler()
    transformers.utils.logging.enable_explicit_format()

    logger.info(
        f"Process rank: {training_args.local_rank}, device: {training_args.device}, n_gpu: {training_args.n_gpu}"
        + f"distributed training: {bool(training_args.local_rank != -1)}, 16-bits training: {training_args.fp16}"
    )
    logger.info(f"Training/evaluation parameters {training_args}")

    rank0 = training_args.local_rank in (-1, 0)

    device = training_args.device
    logger.info('device={}'.format(device))

    pretrained_model_name = model_args.model_name_or_path

    logger.info('Loading pretrained model "%s"', pretrained_model_name)
    tokenizer = transformers.AutoTokenizer.from_pretrained(pretrained_model_name)
    model = transformers.T5ForConditionalGeneration.from_pretrained(pretrained_model_name, torch_dtype=torch.bfloat16)
    model.to(device)

    tokenizer.add_special_tokens({'bos_token': '<s>', 'eos_token': '</s>', 'pad_token': '<pad>'})

    if rank0:
        print_gpu_utilization()
        logger.info('\nTokenizer:')
        for token in '<s> </s> <pad>'.split():
            logger.info('token "{}" id={}'.format(token, str(tokenizer.encode(token, add_special_tokens=False))))

    logger.info('Loading dataset "{}"...'.format(data_args.dataset_path))
    train_samples = load_samples(data_args.dataset_path, tokenizer)
    logger.info('Train samples: {}'.format(len(train_samples)))

    train_dataset = SFTDataset(train_samples, tokenizer)
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        tokenizer=tokenizer,
        data_collator=None,
    )

    try:
        logger.info('Start training...')
        train_result = trainer.train(resume_from_checkpoint=True)

        if rank0:
            metrics = train_result.metrics
            trainer.log_metrics("train", metrics)
            trainer.save_metrics("train", metrics)
    except KeyboardInterrupt:
        print('!!! Ctrl+C !!!')

    logger.info('Saving the model and tokenizer')
    trainer.save_model(output_dir=training_args.output_dir)
    tokenizer.save_pretrained(training_args.output_dir)