using System;

namespace Lanswitch.Domain.Entities;

public class GroupMessageContext : BaseEntity
{
    public long GroupId { get; set; }
    public long TelegramChatId { get; set; }
    public long? SenderUserId { get; set; }
    public string SenderName { get; set; } = "";
    public string UserMessage { get; set; } = "";
    public string BotReply { get; set; } = "";
    public float[]? Embedding { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual TelegramGroup? Group { get; set; }

    [System.Text.Json.Serialization.JsonIgnore]
    public virtual User? SenderUser { get; set; }
}
