using System;
using Deepgram;
using Deepgram.Models.Listen.v1.REST;

public class Test
{
    public static void Main()
    {
        var options = new DeepgramClientOptions("fake-api-key");
        Console.WriteLine(options.GetType().GetProperty("Timeout")?.Name);
    }
}
