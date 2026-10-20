FROM mcr.microsoft.com/devcontainers/python:1-3.12-bookworm

# This image includes an unused Yarn apt source with an outdated signing key.
# Remove that source before devcontainer Features run apt-get update; otherwise
# docker-in-docker fails with NO_PUBKEY 62D54FD4003F6525 and Codespaces recovers
# into an Alpine container without the workshop's Python environment.
# Package signature verification stays enabled for all retained repositories.
RUN rm -f /etc/apt/sources.list.d/yarn.list /etc/apt/sources.list.d/yarn.sources
