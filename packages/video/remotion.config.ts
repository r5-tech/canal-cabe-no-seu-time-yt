import { Config } from "@remotion/cli/config";

// Ajustado para VPS 2 vCPU / 8 GB
Config.setConcurrency(2);
Config.setVideoImageFormat("jpeg");
Config.setX264Preset("veryfast");
Config.setCrf(23);
