FROM golang:1.23-alpine AS builder
WORKDIR /src
RUN apk add --no-cache build-base
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/bcm-api ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=builder /out/bcm-api /app/bcm-api
USER app
EXPOSE 8080
ENTRYPOINT ["/app/bcm-api"]
